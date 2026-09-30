import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SavePaymentMethodDto } from './dto/save-payment-method.dto';
import { PaymentMethodsService } from './payment-methods.service';
import { manualTransfer } from '../manual-orders/manual-transfer';

describe('Custom payments', () => {
  it('requires a custom name and accepts standard methods without it', async () => {
    for (const name of [undefined, '', ' ']) {
      expect(
        await validate(
          plainToInstance(SavePaymentMethodDto, {
            type: 'other',
            active: true,
            name,
          }),
        ),
      ).not.toEqual([]);
    }
    for (const dto of [
      { type: 'other', name: ' Vale-refeição ', active: true },
      { type: 'cash', active: true },
    ]) {
      expect(
        await validate(plainToInstance(SavePaymentMethodDto, dto)),
      ).toEqual([]);
    }
  });
  it('persists the custom label and preserves it on manual transfer', async () => {
    const repo = {
      create: (v: unknown) => v,
      save: jest.fn(async (v) => ({ ...v, id: 1 })),
    };
    const service = new PaymentMethodsService(repo as never);
    expect(
      await service.save({
        type: 'other',
        name: ' Vale-refeição ',
        active: true,
      }),
    ).toMatchObject({ type: 'other', name: 'Vale-refeição' });
    const transferred = manualTransfer(
      {
        name: 'Ana',
        items: [{ name: 'Pizza', quantity: 1, unitPrice: 40, details: [] }],
        customer: { payment: 'Vale-refeição' },
      },
      'out_for_delivery',
    );
    expect(transferred.payment).toMatchObject({
      type: 'other',
      name: 'Vale-refeição',
    });
    expect(transferred.dispatchedAt).toBeInstanceOf(Date);
  });
});
