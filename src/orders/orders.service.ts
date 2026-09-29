import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager, In, QueryFailedError } from 'typeorm';
import { createHash, randomBytes } from 'crypto';
import { ListOrdersDto, AdvanceOrderDto } from './dto/manage-order.dto';
import { nextOrderStatus, orderGroups } from './model/order-status';
import { Product } from '../products/entities/product.entity';
import { Pizza } from '../pizzas/entities/pizza.entity';
import { Category } from '../categories/entities/category.entity';
import { OptionalGroup } from '../optionals/entities/optional-group.entity';
import { Neighborhood } from '../neighborhoods/entities/neighborhood.entity';
import { PaymentMethod } from '../payment-methods/entities/payment-method.entity';
import { Order } from './entities/order.entity';
import { CreateOrderDto, QuoteOrderDto } from './dto/create-order.dto';
import { calculateOrder, cents } from './order-pricing';
import type { OrderPayment } from './model/order.model';
@Injectable()
export class OrdersService {
  constructor(private readonly dataSource: DataSource) {}
  private async quoteWith(manager: EntityManager, dto: QuoteOrderDto) {
    const productIds = dto.items
      .filter((i) => i.type === 'product')
      .map((i) => i.productId!);
    const pizzaIds = dto.items
      .filter((i) => i.type === 'pizza')
      .flatMap((i) => i.flavors?.map((f) => f.pizzaId) ?? []);
    const categoryIds = dto.items
      .filter((i) => i.type === 'pizza')
      .map((i) => i.categoryId!);
    const groupIds = dto.items.flatMap((i) =>
      i.optionals.map((o) => o.groupId),
    );
    const products = productIds.length
      ? await manager.getRepository(Product).find({
          where: { id: In(productIds) },
          relations: { category: true },
        })
      : [];
    const pizzas = pizzaIds.length
      ? await manager
          .getRepository(Pizza)
          .find({ where: { id: In(pizzaIds) }, relations: { category: true } })
      : [];
    const categories = categoryIds.length
      ? await manager.getRepository(Category).findBy({ id: In(categoryIds) })
      : [];
    const groups = groupIds.length
      ? await manager
          .getRepository(OptionalGroup)
          .find({ where: { id: In(groupIds) }, relations: { products: true } })
      : [];
    const neighborhood =
      dto.fulfillment === 'delivery'
        ? await manager
            .getRepository(Neighborhood)
            .findOneBy({ id: dto.neighborhoodId })
        : null;
    return calculateOrder(dto, {
      products,
      pizzas,
      categories,
      groups,
      neighborhood,
    });
  }
  quote(dto: QuoteOrderDto) {
    return this.dataSource.transaction('REPEATABLE READ', (manager) =>
      this.quoteWith(manager, dto),
    );
  }
  private response(order: Order) {
    const { requestId, requestHash, trackingToken, ...response } = order;
    return {
      ...response,
      neighborhood: order.address
        ? {
            id: order.address.neighborhoodId,
            name: order.address.neighborhoodName,
          }
        : null,
    };
  }
  private repeat(order: Order, hash: string) {
    if (order.requestHash !== hash)
      throw new ConflictException(
        'Esta tentativa já foi usada em outro pedido.',
      );
    return { ...this.response(order), trackingToken: order.trackingToken };
  }
  async create(dto: CreateOrderDto) {
    const hash = createHash('sha256').update(JSON.stringify(dto)).digest('hex');
    try {
      return await this.dataSource.transaction(
        'REPEATABLE READ',
        async (manager) => {
          const repo = manager.getRepository(Order);
          const existing = await repo.findOneBy({ requestId: dto.requestId });
          if (existing) return this.repeat(existing, hash);
          const quote = await this.quoteWith(manager, dto);
          if (cents(dto.expectedTotal) !== cents(quote.total))
            throw new ConflictException(
              'Os valores foram atualizados. Confira o novo total antes de finalizar.',
            );
          let payment: OrderPayment | null = null;
          if (dto.fulfillment === 'delivery') {
            const method = await manager
              .getRepository(PaymentMethod)
              .findOneBy({ id: dto.paymentMethodId });
            if (!method?.active)
              throw new BadRequestException(
                'Escolha uma forma de pagamento disponível.',
              );
            if (dto.needsChange && method.type !== 'cash')
              throw new BadRequestException(
                'Troco é permitido apenas para pagamento em dinheiro.',
              );
            if (
              dto.needsChange &&
              (dto.changeFor == null ||
                cents(dto.changeFor) < cents(quote.total))
            )
              throw new BadRequestException(
                'O valor para troco deve ser igual ou maior que o total.',
              );
            payment = {
              id: method.id,
              type: method.type,
              pixKey: method.pixKey,
              holderName: method.holderName,
              description: method.description,
              needsChange: !!dto.needsChange,
              changeFor: dto.needsChange ? dto.changeFor! : null,
              change: dto.needsChange
                ? (cents(dto.changeFor!) - cents(quote.total)) / 100
                : null,
            };
          }
          const order = repo.create({
            requestId: dto.requestId,
            requestHash: hash,
            trackingToken: randomBytes(32).toString('hex'),
            customerName: dto.customerName,
            phone: dto.phone,
            fulfillment: dto.fulfillment,
            address:
              dto.fulfillment === 'delivery'
                ? {
                    street: dto.address!.street,
                    number: dto.address!.number,
                    postalCode: dto.address!.postalCode ?? '',
                    neighborhoodId: quote.neighborhood!.id,
                    neighborhoodName: quote.neighborhood!.name,
                  }
                : null,
            payment,
            items: quote.items,
            subtotal: quote.subtotal,
            deliveryFee: quote.deliveryFee,
            total: quote.total,
            status: 'received',
          });
          const saved = await repo.save(order);
          return {
            ...this.response(saved),
            trackingToken: saved.trackingToken,
          };
        },
      );
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string }).code === '23505'
      ) {
        const existing = await this.dataSource
          .getRepository(Order)
          .findOneBy({ requestId: dto.requestId });
        if (existing) return this.repeat(existing, hash);
      }
      throw error;
    }
  }

  async track(token: string | undefined) {
    if (!token || !/^[a-f0-9]{64}$/.test(token))
      throw new NotFoundException('Pedido não encontrado.');
    const order = await this.dataSource
      .getRepository(Order)
      .findOneBy({ trackingToken: token });
    if (!order) throw new NotFoundException('Pedido não encontrado.');
    return {
      id: order.id,
      status: order.status,
      fulfillment: order.fulfillment,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      items: order.items,
      subtotal: order.subtotal,
      deliveryFee: order.deliveryFee,
      total: order.total,
      neighborhood: order.address
        ? {
            id: order.address.neighborhoodId,
            name: order.address.neighborhoodName,
          }
        : null,
    };
  }
  async list(dto: ListOrdersDto) {
    const repo = this.dataSource.getRepository(Order);
    const [items, total] = await repo.findAndCount({
      where: { status: In([...orderGroups[dto.group]]) },
      order: {
        createdAt: dto.group === 'completed' ? 'DESC' : 'ASC',
        id: dto.group === 'completed' ? 'DESC' : 'ASC',
      },
      take: 30,
      skip: (dto.page - 1) * 30,
    });
    const rows = await repo
      .createQueryBuilder('o')
      .select('o.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('o.status')
      .getRawMany<{ status: string; count: string }>();
    const counts = Object.fromEntries(
      Object.entries(orderGroups).map(([key, statuses]) => [
        key,
        rows
          .filter((r) => (statuses as readonly string[]).includes(r.status))
          .reduce((sum, r) => sum + Number(r.count), 0),
      ]),
    );
    return {
      items: items.map((o) => this.response(o)),
      total,
      page: dto.page,
      pageSize: 30,
      counts,
    };
  }
  async findOne(id: number) {
    const order = await this.dataSource.getRepository(Order).findOneBy({ id });
    if (!order) throw new NotFoundException('Pedido não encontrado.');
    return this.response(order);
  }
  async advance(id: number, dto: AdvanceOrderDto) {
    const repo = this.dataSource.getRepository(Order);
    const order = await repo.findOneBy({ id });
    if (!order) throw new NotFoundException('Pedido não encontrado.');
    if (order.status !== dto.expectedStatus)
      throw new ConflictException(
        'O pedido já foi atualizado. Confira a etapa atual.',
      );
    const next = nextOrderStatus(order.status, order.fulfillment);
    if (!next) throw new ConflictException('Este pedido não pode avançar.');
    const result = await repo.update(
      { id, status: dto.expectedStatus },
      { status: next },
    );
    if (!result.affected)
      throw new ConflictException(
        'O pedido já foi atualizado. Confira a etapa atual.',
      );
    return this.findOne(id);
  }
}
