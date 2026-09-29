import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateOrderDto } from './create-order.dto';
import { SavePaymentMethodDto } from '../../payment-methods/dto/save-payment-method.dto';
import { SaveNeighborhoodDto } from '../../neighborhoods/dto/save-neighborhood.dto';
const base = {
  requestId: 'a06db357-6e58-4d3c-8445-a59ac5be5c39',
  customerName: ' Ana ',
  phone: '(11) 99999-9999',
  fulfillment: 'pickup',
  expectedTotal: 20,
  items: [{ type: 'product', productId: 1, quantity: 1 }],
};
describe('Checkout validation', () => {
  it('accepts pickup with only contact and cart; normalizes name and phone', async () => {
    const dto = plainToInstance(CreateOrderDto, base);
    expect(await validate(dto)).toEqual([]);
    expect(dto.customerName).toBe('Ana');
    expect(dto.phone).toBe('11999999999');
  });
  it('delivery requires neighborhood, address and payment', async () => {
    const errors = await validate(
      plainToInstance(CreateOrderDto, { ...base, fulfillment: 'delivery' }),
    );
    expect(errors.map((e) => e.property)).toEqual(
      expect.arrayContaining([
        'neighborhoodId',
        'address',
        'paymentMethodId',
        'needsChange',
      ]),
    );
  });
  it('accepts optional CEP and rejects invalid CEP or fractional item quantity', async () => {
    const delivery = {
      ...base,
      fulfillment: 'delivery',
      neighborhoodId: 1,
      address: { street: 'Rua A', number: 'S/N' },
      paymentMethodId: 1,
      needsChange: false,
    };
    expect(await validate(plainToInstance(CreateOrderDto, delivery))).toEqual(
      [],
    );
    expect(
      await validate(
        plainToInstance(CreateOrderDto, {
          ...delivery,
          address: { ...delivery.address, postalCode: '123' },
        }),
      ),
    ).not.toEqual([]);
    expect(
      await validate(
        plainToInstance(CreateOrderDto, {
          ...base,
          items: [{ type: 'product', productId: 1, quantity: 1.5 }],
        }),
      ),
    ).not.toEqual([]);
  });
  it('requires Pix key and holder only for Pix', async () => {
    expect(
      await validate(
        plainToInstance(SavePaymentMethodDto, { type: 'cash', active: true }),
      ),
    ).toEqual([]);
    expect(
      await validate(
        plainToInstance(SavePaymentMethodDto, { type: 'pix', active: true }),
      ),
    ).not.toEqual([]);
    expect(
      await validate(
        plainToInstance(SavePaymentMethodDto, {
          type: 'pix',
          active: true,
          pixKey: 'chave',
          holderName: 'Loja',
          description: 'Pedido',
        }),
      ),
    ).toEqual([]);
  });
  it('allows free delivery but rejects negative fees', async () => {
    expect(
      await validate(
        plainToInstance(SaveNeighborhoodDto, {
          name: 'Centro',
          fee: 0,
          active: true,
        }),
      ),
    ).toEqual([]);
    expect(
      await validate(
        plainToInstance(SaveNeighborhoodDto, {
          name: 'Centro',
          fee: -1,
          active: true,
        }),
      ),
    ).not.toEqual([]);
  });
});

it('validates flavor extras and trims pizza observations with a 500 character limit', async () => {
  const extra = {
    groupId: 1,
    itemId: 'a06db357-6e58-4d3c-8445-a59ac5be5c39',
    quantity: 2,
  };
  const pizza = {
    type: 'pizza',
    categoryId: 1,
    sizeId: extra.itemId,
    quantity: 1,
    observation: '  Bem assada  ',
    flavors: [{ pizzaId: 1, optionals: [extra] }],
  };
  const dto = plainToInstance(CreateOrderDto, { ...base, items: [pizza] });
  expect(await validate(dto)).toEqual([]);
  expect(dto.items[0].observation).toBe('Bem assada');
  for (const invalid of [
    { ...pizza, observation: 'x'.repeat(501) },
    {
      ...pizza,
      flavors: [{ pizzaId: 1, optionals: [{ ...extra, quantity: -1 }] }],
    },
    { ...pizza, flavors: [{ pizzaId: 1, optionals: [extra, extra] }] },
    { ...pizza, flavors: [{ pizzaId: 1, optionals: null }] },
  ])
    expect(
      await validate(
        plainToInstance(CreateOrderDto, { ...base, items: [invalid] }),
      ),
    ).not.toEqual([]);
});
