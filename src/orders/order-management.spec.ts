import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { OrdersService } from './orders.service';
import { Order } from './entities/order.entity';
import { nextOrderStatus } from './model/order-status';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AdvanceOrderDto, ListOrdersDto } from './dto/manage-order.dto';
describe('Order progression and tracking', () => {
  const token = 'a'.repeat(64);
  let order: Order;
  let service: OrdersService;
  let repo: {
    findOneBy: jest.Mock;
    update: jest.Mock;
    findAndCount: jest.Mock;
    createQueryBuilder: jest.Mock;
    countBy: jest.Mock;
  };
  beforeEach(() => {
    order = {
      id: 1,
      status: 'received',
      fulfillment: 'pickup',
      trackingToken: token,
      requestId: 'private-request',
      requestHash: 'private-hash',
      customerName: 'Ana',
      phone: '11999999999',
      address: null,
      payment: null,
      items: [],
      total: 20,
      subtotal: 20,
      deliveryFee: 0,
    } as Order;
    repo = {
      countBy: jest.fn().mockResolvedValue(3),
      findOneBy: jest.fn((query) =>
        Promise.resolve(
          query.trackingToken && query.trackingToken !== token ? null : order,
        ),
      ),
      update: jest.fn((where, values) => {
        if (order.status !== where.status)
          return Promise.resolve({ affected: 0 });
        order = { ...order, ...values };
        return Promise.resolve({ affected: 1 });
      }),
      findAndCount: jest.fn(() => Promise.resolve([[order], 1])),
      createQueryBuilder: jest.fn(),
    };
    const query = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([
        { status: 'received', count: '1' },
        { status: 'accepted', count: '2' },
        { status: 'ready', count: '3' },
      ]),
    };
    repo.createQueryBuilder.mockReturnValue(query);
    service = new OrdersService({
      getRepository: () => repo,
    } as unknown as DataSource);
  });
  it('counts only received orders as new notifications', async () => {
    expect(await service.notifications()).toEqual({ newOrders: 3 });
    expect(repo.countBy).toHaveBeenCalledWith({ status: 'received' });
  });
  it.each(['pickup', 'delivery'] as const)(
    'moves %s orders through every stage without skipping',
    async (fulfillment) => {
      order.fulfillment = fulfillment;
      for (const status of [
        'accepted',
        'preparing',
        fulfillment === 'pickup' ? 'ready' : 'out_for_delivery',
        'completed',
      ]) {
        const result = await service.advance(1, {
          expectedStatus: order.status as AdvanceOrderDto['expectedStatus'],
        });
        expect(result.status).toBe(status);
        if (
          fulfillment === 'delivery' &&
          ['out_for_delivery', 'completed'].includes(status)
        ) {
          expect(result.dispatchedAt).toBeInstanceOf(Date);
          if (status === 'completed')
            expect(repo.update).toHaveBeenLastCalledWith(expect.anything(), {
              status: 'completed',
            });
        }
      }
      await expect(
        service.advance(1, { expectedStatus: 'completed' }),
      ).rejects.toThrow('não pode avançar');
    },
  );
  it('rejects stale requests and concurrent double clicks', async () => {
    await service.advance(1, { expectedStatus: 'received' });
    await expect(
      service.advance(1, { expectedStatus: 'received' }),
    ).rejects.toThrow('já foi atualizado');
    repo.update.mockResolvedValueOnce({ affected: 0 });
    await expect(
      service.advance(1, { expectedStatus: 'accepted' }),
    ).rejects.toThrow('já foi atualizado');
    expect(order.status).toBe('accepted');
  });
  it('never allows wrong fulfillment terminal states or unknown stages', () => {
    expect(nextOrderStatus('ready', 'delivery')).toBeNull();
    expect(nextOrderStatus('out_for_delivery', 'pickup')).toBeNull();
    expect(nextOrderStatus('unknown', 'pickup')).toBeNull();
  });
  it('requires the unguessable tracking token and excludes personal data', async () => {
    for (const invalid of [undefined, '1', 'b'.repeat(64)])
      await expect(service.track(invalid)).rejects.toThrow('não encontrado');
    const result = await service.track(token);
    expect(result).toMatchObject({ id: 1, status: 'received', total: 20 });
    for (const key of [
      'trackingToken',
      'requestId',
      'requestHash',
      'customerName',
      'phone',
      'address',
      'payment',
    ])
      expect(result).not.toHaveProperty(key);
  });
  it('admin detail and paginated list never expose tracking credentials', async () => {
    const result = await service.list({ group: 'placed', page: 2 });
    expect(result.counts).toMatchObject({ placed: 3, waiting: 3 });
    expect(repo.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ take: 30, skip: 30 }),
    );
    for (const value of [result.items[0], await service.findOne(1)])
      for (const key of ['trackingToken', 'requestId', 'requestHash'])
        expect(value).not.toHaveProperty(key);
  });
  it('filters pickup and dates using Brazil midnight, including counters', async () => {
    await service.list({
      group: 'waiting',
      page: 1,
      date: '2026-10-03',
      fulfillment: 'pickup',
    });
    const filter = repo.findAndCount.mock.calls[0][0].where;
    expect(filter.fulfillment).toBe('pickup');
    expect(filter.createdAt.objectLiteralParameters).toEqual({
      start: new Date('2026-10-03T03:00:00Z'),
      end: new Date('2026-10-04T03:00:00Z'),
    });
    expect(repo.createQueryBuilder().where).toHaveBeenCalledWith(
      'o.createdAt >= :start AND o.createdAt < :end',
      filter.createdAt.objectLiteralParameters,
    );
  });
  it('searches names or partial order numbers across all stages', async () => {
    await service.list({ group: 'all', page: 1, search: '#123' });
    const filters = repo.findAndCount.mock.calls[0][0].where;
    expect(filters).toHaveLength(2);
    expect(filters[0].status).toBeUndefined();
    expect(filters[0].customerName.value).toBe('%123%');
    expect(filters[1].id.objectLiteralParameters).toEqual({
      orderNumber: '%123%',
    });
  });
  it('validates dates and optional search filters', async () => {
    expect(
      await validate(
        plainToInstance(ListOrdersDto, {
          group: 'all',
          search: 'Ana',
          date: '2026-10-03',
          fulfillment: 'delivery',
        }),
      ),
    ).toEqual([]);
    for (const date of ['2026-02-30', '2026-10-03T12:00:00Z', 'invalid']) {
      expect(
        (await validate(plainToInstance(ListOrdersDto, { date }))).length,
      ).toBeGreaterThan(0);
    }
    expect(
      (
        await validate(
          plainToInstance(ListOrdersDto, { search: 'a'.repeat(101) }),
        )
      ).length,
    ).toBeGreaterThan(0);
  });
  it('validates filters, pagination and expected status', async () => {
    expect(await validate(plainToInstance(ListOrdersDto, {}))).toEqual([]);
    expect(
      await validate(
        plainToInstance(ListOrdersDto, { page: '2', group: 'waiting' }),
      ),
    ).toEqual([]);
    expect(
      await validate(
        plainToInstance(ListOrdersDto, { page: 0, group: 'wrong' }),
      ),
    ).toHaveLength(2);
    expect(
      await validate(
        plainToInstance(AdvanceOrderDto, { expectedStatus: 'wrong' }),
      ),
    ).not.toEqual([]);
  });
});
