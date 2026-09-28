import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateProductDto } from './create-product.dto';
import { UpdateProductDto } from './update-product.dto';

describe('Product DTO validation', () => {
  it('trims ingredients without sorting or parsing the description', async () => {
    const dto = plainToInstance(CreateProductDto, {
      name: 'Hambúrguer',
      price: 20,
      categoryId: 1,
      description: 'Feito na chapa',
      ingredients: [' Pão ', 'hambúrguer', 'queijo', 'salada', 'tomate'],
    });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.ingredients).toEqual([
      'Pão',
      'hambúrguer',
      'queijo',
      'salada',
      'tomate',
    ]);
    expect(dto.description).toBe('Feito na chapa');
  });
  it('rejects blank, duplicate, non-text and oversized ingredients', async () => {
    for (const ingredients of [
      null,
      'Pão, queijo',
      [' '],
      ['Pão', ' pão '],
      [123],
      ['a'.repeat(121)],
      Array.from({ length: 51 }, (_, i) => 'Item ' + i),
    ]) {
      expect(
        (await validate(plainToInstance(UpdateProductDto, { ingredients })))
          .length,
      ).toBeGreaterThan(0);
    }
    expect(
      await validate(plainToInstance(UpdateProductDto, { ingredients: [] })),
    ).toHaveLength(0);
  });
  it('rejects invalid fields', async () => {
    const errors = await validate(
      plainToInstance(CreateProductDto, {
        name: ' ',
        price: -1,
        categoryId: 0,
        available: 'yes',
        photo: 'javascript:alert(1)',
      }),
    );
    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining([
        'name',
        'price',
        'categoryId',
        'available',
        'photo',
      ]),
    );
  });
  it('rejects null required update fields and excessive precision', async () => {
    for (const value of [
      { name: null },
      { categoryId: null },
      { price: null },
      { available: null },
      { price: 1.234 },
    ]) {
      expect(
        (await validate(plainToInstance(UpdateProductDto, value))).length,
      ).toBeGreaterThan(0);
    }
  });
  it('allows partial updates and clearing optional fields', async () => {
    expect(
      await validate(
        plainToInstance(UpdateProductDto, {
          photo: null,
          promotionalPrice: null,
        }),
      ),
    ).toHaveLength(0);
  });
});

describe('Product weekdays', () => {
  it('accepts valid weekdays and rejects empty, duplicate, null or invalid days', async () => {
    expect(
      await validate(
        plainToInstance(UpdateProductDto, { availableDays: [0, 2, 6] }),
      ),
    ).toHaveLength(0);
    for (const availableDays of [[], null, [1, 1], [7], [-1], [1.5], ['1']])
      expect(
        (await validate(plainToInstance(UpdateProductDto, { availableDays })))
          .length,
      ).toBeGreaterThan(0);
  });
});
