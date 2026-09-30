import { Order } from "../orders/entities/order.entity";
import { manualTransfer } from "./manual-transfer";
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
} from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import {
  Column,
  DataSource,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from "typeorm";
import {
  IsArray,
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
} from "class-validator";
import { Type } from "class-transformer";

// Notes deliberately allow incomplete customer details and unfinished item drafts.
class ManualNoteData {
  @IsUUID() id!: string;
  @IsOptional() @IsInt() @Min(0) revision?: number;
  @IsOptional() @IsInt() transferredOrderId?: number;
  @IsString() @MaxLength(500) name!: string;
  @IsArray() @ArrayMaxSize(1000) items!: unknown[];
  @IsObject() customer!: Record<string, unknown>;
  @IsOptional() @IsIn(["open", "cancelled", "transferred"]) lifecycle?:
    "open" | "cancelled" | "transferred";
  @IsOptional() @IsIn(["ready", "out_for_delivery"]) transferTarget?:
    "ready" | "out_for_delivery";
  @IsObject() @IsOptional() pendingItem?: Record<string, unknown>;
}
export class SaveManualNoteDto {
  @IsObject()
  @ValidateNested()
  @Type(() => ManualNoteData)
  data!: ManualNoteData;
}
export class TransferManualNoteDto extends SaveManualNoteDto {
  @IsIn(["ready", "out_for_delivery"]) target!: "ready" | "out_for_delivery";
}
@Entity("manual_order_notes")
export class ManualOrderNote {
  @PrimaryColumn("uuid") id!: string;
  @Column("jsonb") data!: object;
  @UpdateDateColumn() updatedAt!: Date;
}
@Injectable()
export class ManualOrdersService {
  constructor(private readonly dataSource: DataSource) {}
  list() {
    return this.dataSource
      .getRepository(ManualOrderNote)
      .find({ order: { updatedAt: "ASC" } });
  }
  async save(id: string, dto: SaveManualNoteDto) {
    return this.dataSource.transaction(async (manager) => {
      await manager.query("SELECT pg_advisory_xact_lock(hashtext($1))", [id]);
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
      if (lifecycle === "transferred" || lifecycle === "cancelled")
        return existing!;
      return notes.save(
        notes.create({
          id,
          data: {
            ...dto.data,
            id,
            lifecycle:
              dto.data.lifecycle === "cancelled" ? "cancelled" : "open",
          },
        }),
      );
    });
  }
  async transfer(id: string, dto: TransferManualNoteDto) {
    return this.dataSource.transaction(async (manager) => {
      await manager.query("SELECT pg_advisory_xact_lock(hashtext($1))", [id]);
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
      if (lifecycle === "transferred") return existing!;
      if (lifecycle === "cancelled")
        throw new ConflictException("Este card foi cancelado.");
      const orders = manager.getRepository(Order);
      const snapshot = manualTransfer(dto.data, dto.target);
      const previous = await orders.findOneBy({ requestId: id });
      if (previous && previous.status !== "manual_draft")
        throw new ConflictException("O pedido já está em outra etapa.");
      const order = await orders.save(
        orders.create({
          ...previous,
          ...snapshot,
          requestId: id,
          requestHash: "manual",
        }),
      );
      return notes.save(
        notes.create({
          id,
          data: {
            ...dto.data,
            id,
            lifecycle: "transferred",
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
    if (!reference || reference.source !== "manual")
      throw new NotFoundException("Pedido manual não encontrado.");
    return this.dataSource.transaction(async (manager) => {
      await manager.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
        reference.requestId,
      ]);
      const orders = manager.getRepository(Order);
      const order = await orders.findOne({
        where: { id: orderId },
        lock: { mode: "pessimistic_write" },
      });
      if (!order) throw new NotFoundException("Pedido não encontrado.");
      const notes = manager.getRepository(ManualOrderNote);
      const note = await notes.findOneBy({ id: order.requestId });
      if (!note) throw new NotFoundException("Card original não encontrado.");
      if (order.status === "manual_draft") return note;
      if (!["ready", "out_for_delivery"].includes(order.status))
        throw new ConflictException(
          "Apenas pedidos aguardando retirada ou em entrega podem voltar à edição.",
        );
      const data = note.data as ManualNoteData;
      await orders.update(order.id, { status: "manual_draft" });
      return notes.save({
        ...note,
        data: {
          ...data,
          lifecycle: "open",
          revision: (data.revision ?? 0) + 1,
          transferTarget: undefined,
        },
      });
    });
  }
}
@Controller("manual-orders")
export class ManualOrdersController {
  constructor(private readonly service: ManualOrdersService) {}
  @Get() @Header("Cache-Control", "no-store") list() {
    return this.service.list();
  }
  @Post("from-order/:id/reopen") reopen(@Param("id", ParseIntPipe) id: number) {
    return this.service.reopen(id);
  }
  @Post(":id/transfer") transfer(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: TransferManualNoteDto,
  ) {
    return this.service.transfer(id, dto);
  }
  @Put(":id") save(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: SaveManualNoteDto,
  ) {
    return this.service.save(id, dto);
  }
}
@Module({
  imports: [TypeOrmModule.forFeature([ManualOrderNote, Order])],
  controllers: [ManualOrdersController],
  providers: [ManualOrdersService],
})
export class ManualOrdersModule {}
