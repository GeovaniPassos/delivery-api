import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateProductDto } from './create-product.dto';
import { UpdateProductDto } from './update-product.dto';

describe('Product DTO validation', () => {
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
