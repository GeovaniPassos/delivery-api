import { DataSource, EntityManager } from 'typeorm';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { Order } from './entities/order.entity';
import { PaymentMethod } from '../payment-methods/entities/payment-method.entity';
describe('Order creation', () => {
  const quote = {
    items: [
      { name: 'Lanche', quantity: 1, unitPrice: 20, total: 20, details: [] },
    ],
    subtotal: 20,
    deliveryFee: 5,
    total: 25,
    neighborhood: { id: 1, name: 'Centro' },
  };
  let service: OrdersService;
  let saved: Order | null;
  let method: Partial<PaymentMethod>;
  let save: jest.Mock;
  const dto = (): CreateOrderDto => ({
    requestId: 'a06db357-6e58-4d3c-8445-a59ac5be5c39',
    customerName: 'Ana',
    phone: '11999999999',
    fulfillment: 'delivery',
    neighborhoodId: 1,
    address: { street: 'Rua A', number: '10' },
    paymentMethodId: 1,
    needsChange: true,
    changeFor: 50,
    expectedTotal: 25,
    items: [],
  });
  beforeEach(() => {
    saved = null;
    method = {
      id: 1,
      type: 'cash',
      active: true,
      pixKey: null,
      holderName: null,
      description: '',
    };
    save = jest.fn((order) => {
      saved = { ...order, id: 7 };
      return Promise.resolve(saved);
    });
    const repo = {
      findOneBy: jest.fn(() => Promise.resolve(saved)),
      create: (value: unknown) => value,
      save,
    };
    const manager = {
      getRepository: (entity: unknown) =>
        entity === Order ? repo : { findOneBy: () => Promise.resolve(method) },
    } as unknown as EntityManager;
    const dataSource = {
      transaction: (_level: unknown, run: (m: EntityManager) => unknown) =>
        run(manager),
    } as DataSource;
    service = new OrdersService(dataSource);
    jest
      .spyOn(
        service as unknown as { quoteWith: () => Promise<unknown> },
        'quoteWith',
      )
      .mockResolvedValue(quote);
  });
  it('stores order and change snapshots; repeat submission returns same order once', async () => {
    const input = dto();
    const first = await service.create(input);
    const second = await service.create(input);
    expect(first).toMatchObject({
      id: 7,
      total: 25,
      payment: { changeFor: 50, change: 25 },
      address: { neighborhoodName: 'Centro' },
    });
    expect(second).toEqual(first);
    expect(save).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveProperty('requestHash');
    await expect(
      service.create({ ...input, customerName: 'Outro' }),
    ).rejects.toThrow('outro pedido');
  });
  it('pickup has no address or payment', async () => {
    const result = await service.create({ ...dto(), fulfillment: 'pickup' });
    expect(result.address).toBeNull();
    expect(result.payment).toBeNull();
  });
  it('rejects stale total, insufficient cash, noncash change and inactive payment', async () => {
    await expect(
      service.create({ ...dto(), expectedTotal: 24 }),
    ).rejects.toThrow('valores foram atualizados');
    await expect(service.create({ ...dto(), changeFor: 24 })).rejects.toThrow(
      'igual ou maior',
    );
    method.type = 'pix';
    await expect(service.create(dto())).rejects.toThrow(
      'apenas para pagamento em dinheiro',
    );
    method.active = false;
    await expect(
      service.create({ ...dto(), needsChange: false }),
    ).rejects.toThrow('pagamento disponível');
    expect(save).not.toHaveBeenCalled();
  });
  it('propagates persistence failures without returning a confirmation', async () => {
    save.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(service.create(dto())).rejects.toThrow('database unavailable');
  });
});
