import { Order } from '../orders/entities/order.entity';
import { manualTransfer } from './manual-transfer';
import { reserveOrderNumber } from '../orders/reserve-order-number';
import {
  Body,
  Controller,
  Get,
  Header,
  Injectable,
  Module,
  Param,
  ParseUUIDPipe,
  ParseIntPipe,
  NotFoundException,
  Put,
  Post,
  ConflictException,
  Delete,
  GoneException,
} from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Column,
  DataSource,
  Entity,
  EntityManager,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  IsArray,
  IsDateString,
  IsInt,
  Min,
  IsIn,
  IsOptional,
  IsObject,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';

// Notes deliberately allow incomplete customer details and unfinished item drafts.
class ManualNoteData {
  @IsOptional() @IsDateString() createdAt?: string;
  @IsUUID() id!: string;
  @IsOptional() @IsInt() @Min(1) orderNumber?: number;
  @IsOptional() @IsInt() @Min(0) revision?: number;
  @IsOptional() @IsInt() transferredOrderId?: number;
  @IsString() @MaxLength(500) name!: string;
  @IsArray() @ArrayMaxSize(1000) items!: unknown[];
  @IsObject() customer!: Record<string, unknown>;
  @IsOptional() @IsIn(['open', 'cancelled', 'transferred']) lifecycle?:
    | 'open'
    | 'cancelled'
    | 'transferred';
  @IsOptional() @IsIn(['ready', 'out_for_delivery']) transferTarget?:
    | 'ready'
    | 'out_for_delivery';
  @IsObject() @IsOptional() pendingItem?: Record<string, unknown>;
}
export class SaveManualNoteDto {
  @IsObject()
  @ValidateNested()
  @Type(() => ManualNoteData)
  data!: ManualNoteData;
}
export class TransferManualNoteDto extends SaveManualNoteDto {
  @IsIn(['ready', 'out_for_delivery']) target!: 'ready' | 'out_for_delivery';
}
@Entity('manual_order_notes')
export class ManualOrderNote {
  @PrimaryColumn('uuid') id!: string;
  @Column('jsonb') data!: object;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt!: Date;
}
// Retain only the deleted UUID, never the customer's data or the card contents.
@Entity('manual_order_deletions')
export class ManualOrderDeletion {
  @PrimaryColumn('uuid') id!: string;
}
@Injectable()
export class ManualOrdersService {
  constructor(private readonly dataSource: DataSource) {}
  async list() {
    const notes = await this.dataSource
      .getRepository(ManualOrderNote)
      .find({ order: { updatedAt: 'ASC' } });
    const deleted = await this.dataSource
      .getRepository(ManualOrderDeletion)
      .find();
    return [...notes, ...deleted.map(({ id }) => ({ id, deleted: true }))];
  }
  async remove(id: string) {
    return this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [id]);
      return this.removeCard(manager, id);
    });
  }
  private async removeCard(manager: EntityManager, id: string) {
    const notes = manager.getRepository(ManualOrderNote);
    const existing = await notes.findOneBy({ id });
    if (
      (existing?.data as ManualNoteData | undefined)?.lifecycle ===
      'transferred'
    )
      throw new ConflictException('O pedido já está em outra etapa.');
    const deletions = manager.getRepository(ManualOrderDeletion);
    await deletions.save({ id });
    await manager
      .getRepository(Order)
      .delete({ requestId: id, source: 'manual', status: 'manual_draft' });
    await notes.delete({ id });
    return { id, deleted: true };
  }
  async save(id: string, dto: SaveManualNoteDto) {
    return this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [id]);
      if (await manager.getRepository(ManualOrderDeletion).findOneBy({ id }))
        throw new GoneException('Este card foi excluído.');
      const notes = manager.getRepository(ManualOrderNote);
      const existing = await notes.findOneBy({ id });
      const lifecycle = (existing?.data as { lifecycle?: string } | undefined)
        ?.lifecycle;
      if (lifecycle === 'transferred') return existing!;
      if (dto.data.lifecycle === 'cancelled' || lifecycle === 'cancelled')
        return this.removeCard(manager, id);
      if (
        existing &&
        ((existing.data as { revision?: number }).revision ?? 0) !==
          (dto.data.revision ?? 0)
      )
        return existing;
      return notes.save(
        notes.create({
          id,
          data: {
            ...dto.data,
            id,
            orderNumber:
              (existing?.data as ManualNoteData | undefined)?.orderNumber ??
              (await reserveOrderNumber(manager)),
            lifecycle: 'open',
          },
        }),
      );
    });
  }
  async transfer(id: string, dto: TransferManualNoteDto) {
    return this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [id]);
      if (await manager.getRepository(ManualOrderDeletion).findOneBy({ id }))
        throw new GoneException('Este card foi excluído.');
      const notes = manager.getRepository(ManualOrderNote);
      const existing = await notes.findOneBy({ id });
      if (
        existing &&
        ((existing.data as { revision?: number }).revision ?? 0) !==
          (dto.data.revision ?? 0)
      )
        return existing;
      const lifecycle = (existing?.data as { lifecycle?: string } | undefined)
        ?.lifecycle;
      if (lifecycle === 'transferred') return existing!;
      if (lifecycle === 'cancelled')
        throw new ConflictException('Este card foi cancelado.');
      const orders = manager.getRepository(Order);
      const snapshot = manualTransfer(dto.data, dto.target);
      const previous = await orders.findOneBy({ requestId: id });
      if (previous && previous.status !== 'manual_draft')
        throw new ConflictException('O pedido já está em outra etapa.');
      const orderNumber =
        previous?.id ??
        (existing?.data as ManualNoteData | undefined)?.orderNumber ??
        (await reserveOrderNumber(manager));
      const order = await orders.save(
        orders.create({
          ...previous,
          ...snapshot,
          id: orderNumber,
          createdAt:
            previous?.createdAt ??
            (dto.data.createdAt ? new Date(dto.data.createdAt) : new Date()),
          requestId: id,
          requestHash: 'manual',
        }),
      );
      return notes.save(
        notes.create({
          id,
          data: {
            ...dto.data,
            id,
            orderNumber,
            lifecycle: 'transferred',
            transferredOrderId: order.id,
            transferTarget: undefined,
          },
        }),
      );
    });
  }
  async reopen(orderId: number) {
    const reference = await this.dataSource
      .getRepository(Order)
      .findOneBy({ id: orderId });
    if (!reference || reference.source !== 'manual')
      throw new NotFoundException('Pedido manual não encontrado.');
    return this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        reference.requestId,
      ]);
      const orders = manager.getRepository(Order);
      const order = await orders.findOne({
        where: { id: orderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) throw new NotFoundException('Pedido não encontrado.');
      const notes = manager.getRepository(ManualOrderNote);
      const note = await notes.findOneBy({ id: order.requestId });
      if (!note) throw new NotFoundException('Card original não encontrado.');
      if (order.status === 'manual_draft') return note;
      if (!['ready', 'out_for_delivery'].includes(order.status))
        throw new ConflictException(
          'Apenas pedidos aguardando retirada ou em entrega podem voltar à edição.',
        );
      const data = note.data as ManualNoteData;
      await orders.update(order.id, { status: 'manual_draft' });
      return notes.save({
        ...note,
        data: {
          ...data,
          orderNumber: order.id,
          lifecycle: 'open',
          revision: (data.revision ?? 0) + 1,
          transferTarget: undefined,
        },
      });
    });
  }
}
@Controller('manual-orders')
export class ManualOrdersController {
  constructor(private readonly service: ManualOrdersService) {}
  @Get() @Header('Cache-Control', 'no-store') list() {
    return this.service.list();
  }
  @Post('from-order/:id/reopen') reopen(@Param('id', ParseIntPipe) id: number) {
    return this.service.reopen(id);
  }
  @Post(':id/transfer') transfer(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TransferManualNoteDto,
  ) {
    return this.service.transfer(id, dto);
  }
  @Put(':id') save(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SaveManualNoteDto,
  ) {
    return this.service.save(id, dto);
  }
  @Delete(':id') remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
@Module({
  imports: [
    TypeOrmModule.forFeature([ManualOrderNote, ManualOrderDeletion, Order]),
  ],
  controllers: [ManualOrdersController],
  providers: [ManualOrdersService],
})
export class ManualOrdersModule {}
