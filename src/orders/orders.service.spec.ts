import { DataSource, EntityManager } from 'typeorm';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { Order } from './entities/order.entity';
import { PaymentMethod } from '../payment-methods/entities/payment-method.entity';
import { StoreSettings } from '../store-settings/entities/store-settings.entity';
import { Category } from '../categories/entities/category.entity';
import { Pizza } from '../pizzas/entities/pizza.entity';
import { PizzaCategoryCombination } from '../categories/entities/pizza-category-combination.entity';
import { OptionalGroup } from '../optionals/entities/optional-group.entity';
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
  let settings: Partial<StoreSettings>;
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
    settings = { isOpen: true, deliveryMinutes: 45, pickupMinutes: 20 };
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
        entity === Order
          ? repo
          : entity === StoreSettings
            ? { findOne: () => Promise.resolve(settings) }
            : { findOneBy: () => Promise.resolve(method) },
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
    expect(result.estimatedMinutes).toBe(20);
  });
  it('blocks new confirmations when closed but preserves already accepted retries', async () => {
    settings.isOpen = false;
    await expect(service.create(dto())).rejects.toMatchObject({
      response: { code: 'STORE_CLOSED' },
    });
    expect(save).not.toHaveBeenCalled();
    settings.isOpen = true;
    const first = await service.create(dto());
    expect(first.estimatedMinutes).toBe(45);
    settings.isOpen = false;
    expect(await service.create(dto())).toEqual(first);
    expect(save).toHaveBeenCalledTimes(1);
  });
  it('keeps quote and delivery fee queries available when closed', async () => {
    settings.isOpen = false;
    expect(await service.quote(dto())).toMatchObject({
      deliveryFee: 5,
      total: 25,
    });
    expect(save).not.toHaveBeenCalled();
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

it('loads flavor-level optional groups and reciprocal links when quoting a mixed pizza', async () => {
  const days = [0, 1, 2, 3, 4, 5, 6];
  const root = {
    id: 1,
    isPizza: true,
    active: true,
    availableDays: days,
    maxFlavors: 2,
    pricingRule: 'average',
    pizzaSizes: [{ id: 'large', name: 'Grande' }],
  };
  const sweet = {
    ...root,
    id: 2,
    pizzaSizes: [{ id: 'sweet-large', name: 'Grande' }],
  };
  const pizza = (category: typeof root, price: number) => ({
    id: category.id,
    name: 'Sabor ' + category.id,
    categoryId: category.id,
    category,
    available: true,
    availableDays: days,
    ingredients: [],
    prices: [
      { sizeId: category.pizzaSizes[0].id, price, promotionalPrice: null },
    ],
  });
  const findGroups = jest.fn(async (_options: any) => [
    {
      id: 9,
      name: 'Extras',
      kind: 'pizza-extra',
      scope: 'category',
      categoryId: 2,
      quantitative: true,
      maxTotal: 0,
      maxPerOption: 0,
      items: [{ id: 'extra', name: 'Chocolate', price: 5, sizePrices: [] }],
    },
  ]);
  const repositories = new Map<unknown, unknown>([
    [Category, { findBy: async () => [root] }],
    [Pizza, { find: async () => [pizza(root, 40), pizza(sweet, 60)] }],
    [
      PizzaCategoryCombination,
      { find: async () => [{ categoryId: 1, compatibleCategoryId: 2 }] },
    ],
    [OptionalGroup, { find: findGroups }],
  ]);
  const manager = {
    getRepository: (entity: unknown) => repositories.get(entity),
  };
  const source = {
    transaction: (_level: unknown, run: (manager: unknown) => unknown) =>
      run(manager),
  } as unknown as DataSource;
  const service = new OrdersService(source);
  const result = await service.quote({
    fulfillment: 'pickup',
    items: [
      {
        type: 'pizza',
        categoryId: 1,
        sizeId: 'large',
        quantity: 1,
        removedIngredients: [],
        optionals: [],
        flavors: [
          { pizzaId: 1, removedIngredients: [] },
          {
            pizzaId: 2,
            removedIngredients: [],
            optionals: [{ groupId: 9, itemId: 'extra', quantity: 2 }],
          },
        ],
      },
    ],
  });
  expect(result.total).toBe(60);
  expect(findGroups).toHaveBeenCalledTimes(1);
  expect(findGroups.mock.calls[0]?.[0]?.where.id.value).toEqual([9]);
});
