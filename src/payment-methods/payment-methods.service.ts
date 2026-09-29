import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { PaymentMethod } from './entities/payment-method.entity';
import { SavePaymentMethodDto } from './dto/save-payment-method.dto';
@Injectable()
export class PaymentMethodsService {
  constructor(
    @InjectRepository(PaymentMethod)
    private readonly repo: Repository<PaymentMethod>,
  ) {}
  findAll() {
    return this.repo.find({ order: { id: 'ASC' } });
  }
  async save(dto: SavePaymentMethodDto, id?: number) {
    const previous = id ? await this.repo.findOneBy({ id }) : null;
    if (id && !previous)
      throw new NotFoundException('Forma de pagamento não encontrada.');
    try {
      return await this.repo.save(
        this.repo.create({
          ...previous,
          type: dto.type,
          active: dto.active,
          pixKey: dto.type === 'pix' ? dto.pixKey! : null,
          holderName: dto.type === 'pix' ? dto.holderName! : null,
          description:
            dto.type === 'pix' ? (dto.description?.trim() ?? '') : '',
        }),
      );
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string }).code === '23505'
      )
        throw new ConflictException(
          'Essa forma de pagamento já está cadastrada. Edite o cadastro existente.',
        );
      throw error;
    }
  }
  async remove(id: number) {
    const result = await this.repo.delete(id);
    if (!result.affected)
      throw new NotFoundException('Forma de pagamento não encontrada.');
  }
}
