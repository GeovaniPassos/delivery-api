import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreatePizzaDto } from './dto/create-pizza.dto';
import { UpdatePizzaDto } from './dto/update-pizza.dto';
import { PizzaIdsDto } from './dto/bulk-pizzas.dto';
import { CreateCategoryDto } from '../categories/dto/create-category.dto';
const id = 'e77c3e55-f128-489d-8412-3d5bffb92edb';
describe('Pizza request validation', () => {
  const valid = {
    name: 'Mussarela',
    categoryId: 1,
    prices: [{ sizeId: id, price: 40, promotionalPrice: null }],
    availableDays: [0, 6],
  };
  it('accepts prices per size and validates nested decimal fields', async () => {
    expect(await validate(plainToInstance(CreatePizzaDto, valid))).toHaveLength(
      0,
    );
    for (const price of [-1, 0, 10.123, '40', null])
      expect(
        (
          await validate(
            plainToInstance(CreatePizzaDto, {
              ...valid,
              prices: [{ sizeId: id, price }],
            }),
          )
        ).length,
      ).toBeGreaterThan(0);
  });
  it('rejects duplicate sizes, weekdays and invalid weekdays', async () => {
    expect(
      (
        await validate(
          plainToInstance(CreatePizzaDto, {
            ...valid,
            prices: [...valid.prices, ...valid.prices],
          }),
        )
      ).length,
    ).toBeGreaterThan(0);
    for (const availableDays of [[], [1, 1], [7], [-1], [1.5]])
      expect(
        (
          await validate(
            plainToInstance(CreatePizzaDto, { ...valid, availableDays }),
          )
        ).length,
      ).toBeGreaterThan(0);
  });
  it('rejects null required fields in partial updates but allows clearing photos', async () => {
    expect(
      (await validate(plainToInstance(UpdatePizzaDto, { prices: null })))
        .length,
    ).toBeGreaterThan(0);
    expect(
      await validate(plainToInstance(UpdatePizzaDto, { photo: null })),
    ).toHaveLength(0);
  });
  it('validates bulk IDs and category weekdays', async () => {
    for (const ids of [
      [],
      [1, 1],
      [0],
      [1.5],
      Array.from({ length: 201 }, (_, i) => i + 1),
    ])
      expect(
        (await validate(plainToInstance(PizzaIdsDto, { ids }))).length,
      ).toBeGreaterThan(0);
    expect(
      (
        await validate(
          plainToInstance(CreateCategoryDto, {
            name: 'Pizzas',
            availableDays: [],
          }),
        )
      ).length,
    ).toBeGreaterThan(0);
  });
});

describe('Pizza ingredients', () => {
  it('trims items and preserves their order', async () => {
    const dto = plainToInstance(UpdatePizzaDto, {
      ingredients: [' Molho ', 'Queijo', 'Tomate'],
    });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.ingredients).toEqual(['Molho', 'Queijo', 'Tomate']);
  });
  it('rejects invalid items and allows clearing the list', async () => {
    for (const ingredients of [
      null,
      [' '],
      ['Queijo', ' queijo '],
      [12],
      ['a'.repeat(121)],
      Array.from({ length: 51 }, (_, i) => String(i)),
    ]) {
      expect(
        (await validate(plainToInstance(UpdatePizzaDto, { ingredients })))
          .length,
      ).toBeGreaterThan(0);
    }
    expect(
      await validate(plainToInstance(UpdatePizzaDto, { ingredients: [] })),
    ).toHaveLength(0);
  });
});
