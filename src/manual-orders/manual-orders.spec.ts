import {
  ManualOrdersService,
  SaveManualNoteDto,
  ManualOrderNote,
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
    const notes = {
      findOneBy: jest.fn(async () => saved),
      create: (v: ManualOrderNote) => v,
      save: jest.fn(async (v: ManualOrderNote) => (saved = v)),
    };
    const orders = {
      findOneBy: jest.fn().mockResolvedValue(null),
      create: (v: Order) => v,
      save: jest.fn(async (v: Order) => ({ ...v, id: 55 })),
    };
    const manager = {
      query: jest.fn(),
      getRepository: (entity: unknown) =>
        entity === ManualOrderNote ? notes : orders,
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
  it('does not recreate cancelled or transferred notes with late saves', async () => {
    const { service } = setup();
    await service.save(id, { data: { ...data, lifecycle: 'cancelled' } });
    expect((await service.save(id, { data })).data).toMatchObject({
      lifecycle: 'cancelled',
    });
    await expect(
      service.transfer(id, { data, target: 'ready' }),
    ).rejects.toThrow('cancelado');
  });
  it('persists cancellation against a newer revision and prevents late saves from restoring the card', async () => {
    const { service } = setup();
    await service.save(id, {
      data: { ...data, revision: 2, pendingItem: { draft: {} } },
    });
    const cancelled = await service.save(id, {
      data: { ...data, revision: 0, lifecycle: 'cancelled' },
    });
    expect(cancelled.data).toMatchObject({
      lifecycle: 'cancelled',
      revision: 2,
    });
    expect(cancelled.data).not.toHaveProperty('pendingItem', expect.anything());
    expect(await service.save(id, { data: { ...data, revision: 2 } })).toEqual(
      cancelled,
    );
    await expect(
      service.transfer(id, { data: { ...data, revision: 2 }, target: 'ready' }),
    ).rejects.toThrow('cancelado');
  });
  it('preserves delivery details and calculates totals and change', () => {
    const result = manualTransfer(data, 'out_for_delivery');
    expect(result.address?.complement).toBe('Fundos');
    expect(result.total).toBe(70);
    expect(result.payment?.change).toBe(30);
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
        entity === ManualOrderNote ? notes : orders,
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
});
