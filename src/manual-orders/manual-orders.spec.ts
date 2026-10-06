import {
  ManualOrdersService,
  SaveManualNoteDto,
  ManualOrderNote,
  ManualOrderDeletion,
} from './manual-orders.module';
import { Order } from '../orders/entities/order.entity';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { manualTransfer } from './manual-transfer';
describe('Manual order notes', () => {
  const id = '20d28e20-6b8c-48de-a2d7-1fb910507f78';
  const data = {
    id,
    name: 'Ana',
    items: [
      { name: 'Pizza', quantity: 2, unitPrice: 35, details: ['Sem cebola'] },
    ],
    customer: {
      fulfillment: 'delivery',
      complement: 'Fundos',
      payment: 'Dinheiro',
      needsChange: true,
      changeFor: 100,
    },
  };
  function setup() {
    let saved: ManualOrderNote | null = null;
    let deleted: { id: string } | null = null;
    const deletions = {
      findOneBy: jest.fn(async () => deleted),
      save: jest.fn(async (v: { id: string }) => (deleted = v)),
    };
    const notes = {
      findOneBy: jest.fn(async () => saved),
      create: (v: ManualOrderNote) => v,
      save: jest.fn(async (v: ManualOrderNote) => (saved = v)),
      delete: jest.fn(async () => {
        saved = null;
      }),
    };
    const orders = {
      findOneBy: jest.fn().mockResolvedValue(null),
      create: (v: Order) => v,
      save: jest.fn(async (v: Order) => ({ ...v, id: 55 })),
      delete: jest.fn(),
    };
    const manager = {
      query: jest.fn(async (sql: string) =>
        sql.includes('nextval') ? [{ number: 4 }] : undefined,
      ),
      getRepository: (entity: unknown) =>
        entity === ManualOrderNote
          ? notes
          : entity === ManualOrderDeletion
            ? deletions
            : orders,
    };
    const source = {
      transaction: (fn: (m: unknown) => unknown) => fn(manager),
    };
    return {
      service: new ManualOrdersService(source as never),
      notes,
      orders,
      manager,
    };
  }
  it('accepts incomplete delivery notes', async () => {
    expect(
      await validate(
        plainToInstance(SaveManualNoteDto, {
          data: {
            ...data,
            items: [],
            customer: {},
            pendingItem: { draft: { kind: 'pizza' } },
          },
        }),
        { whitelist: true, forbidNonWhitelisted: true },
      ),
    ).toHaveLength(0);
  });
  it('reserves a number once and ignores attempts to change it', async () => {
    const { service, manager, orders } = setup();
    const first = await service.save(id, {
      data: { ...data, orderNumber: 999 },
    });
    expect(first).toMatchObject({ data: { orderNumber: 4 } });
    expect(
      await service.save(id, {
        data: { ...data, name: 'Novo nome', orderNumber: 888 },
      }),
    ).toMatchObject({ data: { orderNumber: 4, name: 'Novo nome' } });
    await service.transfer(id, {
      data: { ...data, orderNumber: 777 },
      target: 'ready',
    });
    expect(orders.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 4 }),
    );
    expect(
      manager.query.mock.calls.filter(([sql]) => sql.includes('nextval')),
    ).toHaveLength(1);
  });
  it('transfers once and returns the same result when a request is retried', async () => {
    const { service, orders, manager } = setup();
    const first = await service.transfer(id, { data, target: 'ready' });
    const second = await service.transfer(id, { data, target: 'ready' });
    expect(second).toEqual(first);
    expect(orders.save).toHaveBeenCalledTimes(1);
    expect(orders.save).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'manual',
        fulfillment: 'pickup',
        status: 'ready',
        total: 70,
      }),
    );
    expect(manager.query).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock(hashtext($1))',
      [id],
    );
  });
  it('physically removes legacy cancellation saves even with a stale revision', async () => {
    const { service, notes } = setup();
    await service.save(id, {
      data: { ...data, revision: 2, pendingItem: { draft: {} } },
    });
    expect(
      await service.save(id, {
        data: { ...data, revision: 0, lifecycle: 'cancelled' },
      }),
    ).toEqual({ id, deleted: true });
    expect(notes.delete).toHaveBeenCalledWith({ id });
    await expect(service.save(id, { data })).rejects.toThrow('excluído');
  });
  it('preserves delivery details and calculates totals and change', () => {
    const result = manualTransfer(data, 'out_for_delivery');
    expect(result.address?.complement).toBe('Fundos');
    expect(result.total).toBe(70);
    expect(result.payment?.change).toBe(30);
  });
  it('physically deletes a card and rejects late saves and transfers', async () => {
    const { service, notes, orders } = setup();
    await service.save(id, { data });
    expect(await service.remove(id)).toEqual({ id, deleted: true });
    expect(notes.delete).toHaveBeenCalledWith({ id });
    expect(orders.delete).toHaveBeenCalledWith({
      requestId: id,
      source: 'manual',
      status: 'manual_draft',
    });
    await expect(service.save(id, { data })).rejects.toThrow('excluído');
    await expect(
      service.transfer(id, { data, target: 'ready' }),
    ).rejects.toThrow('excluído');
    expect(await service.remove(id)).toEqual({ id, deleted: true });
  });
  it('rejects unfinished or invalid items during transfer', () => {
    expect(() =>
      manualTransfer({ ...data, pendingItem: {} }, 'ready'),
    ).toThrow();
    expect(() =>
      manualTransfer({ ...data, items: [{ quantity: -1 }] }, 'ready'),
    ).toThrow();
  });
  it('reopens the same note, removes the order from the waiting stages and rejects stale transfers', async () => {
    const reference = {
      id: 55,
      source: 'manual',
      requestId: id,
      status: 'ready',
    };
    let note = {
      id,
      data: {
        ...data,
        lifecycle: 'transferred',
        transferredOrderId: 55,
        revision: 0,
      },
    };
    const notes = {
      findOneBy: jest.fn(async () => note),
      save: jest.fn(async (value) => (note = value)),
    };
    const orders = {
      findOneBy: jest.fn(async () => reference),
      findOne: jest.fn(async () => reference),
      update: jest.fn(async (_, patch) => Object.assign(reference, patch)),
    };
    const manager = {
      query: jest.fn(),
      getRepository: (entity: unknown) =>
        entity === ManualOrderNote
          ? notes
          : entity === ManualOrderDeletion
            ? { findOneBy: async () => null }
            : orders,
    };
    const source = {
      getRepository: () => orders,
      transaction: (fn: (m: unknown) => unknown) => fn(manager),
    };
    const service = new ManualOrdersService(source as never);
    const restored = await service.reopen(55);
    expect(restored.data).toMatchObject({
      lifecycle: 'open',
      revision: 1,
      transferredOrderId: 55,
    });
    expect(reference.status).toBe('manual_draft');
    expect(await service.reopen(55)).toEqual(restored);
    expect(await service.transfer(id, { data, target: 'ready' })).toEqual(
      restored,
    );
    expect(notes.save).toHaveBeenCalledTimes(1);
  });
  it('updates the existing order when transferring an edited card again', async () => {
    const { service, orders } = setup();
    orders.findOneBy.mockResolvedValue({
      id: 55,
      status: 'manual_draft',
    } as never);
    await service.transfer(id, {
      data: { ...data, revision: 1 },
      target: 'out_for_delivery',
    });
    expect(orders.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 55, status: 'out_for_delivery' }),
    );
  });
  it('includes the manual delivery fee in totals and change, but not in pickup', () => {
    const withFee = {
      ...data,
      customer: { ...data.customer, deliveryFee: 8, neighborhoodId: 3 },
    };
    const delivery = manualTransfer(withFee, 'out_for_delivery');
    expect(delivery).toMatchObject({ subtotal: 70, deliveryFee: 8, total: 78 });
    expect(delivery.payment?.change).toBe(22);
    expect(delivery.address?.neighborhoodId).toBe(3);
    expect(manualTransfer(withFee, 'ready')).toMatchObject({
      subtotal: 70,
      deliveryFee: 0,
      total: 70,
    });
    expect(() =>
      manualTransfer(
        { ...data, customer: { ...data.customer, deliveryFee: -1 } },
        'out_for_delivery',
      ),
    ).toThrow('taxa');
  });
});
