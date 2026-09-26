import { ConflictException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CategoriesService } from './categories.service';
import { Category } from './entities/category.entity';
import { Product } from '../products/entities/product.entity';
import { PizzaPricingRule } from './model/pizza-settings';
describe('CategoriesService', () => {
  const size = { id: 'e77c3e55-f128-489d-8412-3d5bffb92edb', name: 'Grande' };
  let service: CategoriesService;
  let categories: any;
  let products: any;
  let pizzas: any;
  beforeEach(() => {
    categories = {
      create: jest.fn((v) => ({ ...v })),
      save: jest.fn(async (v) => v),
      findOne: jest.fn(async () => ({
        id: 1,
        name: 'Pizzas',
        isPizza: true,
        pizzaSizes: [size],
        availableDays: [0, 1],
        maxFlavors: 2,
        pricingRule: PizzaPricingRule.AVERAGE,
      })),
      delete: jest.fn(async () => ({ affected: 1 })),
    };
    products = { countBy: jest.fn(async () => 0) };
    pizzas = { findBy: jest.fn(async () => []) };
    const manager = {
      getRepository: (type: any) =>
        type === Category ? categories : type === Product ? products : pizzas,
    };
    service = new CategoriesService({
      getRepository: manager.getRepository,
      transaction: (fn: any) => fn(manager),
    } as unknown as DataSource);
  });
  it('preserves legacy category creation with all weekdays', async () => {
    expect(await service.create({ name: 'Lanches' })).toMatchObject({
      availableDays: [0, 1, 2, 3, 4, 5, 6],
      isPizza: false,
      pizzaSizes: [],
    });
  });
  it('rejects removing a priced size and changing a category with pizzas into products', async () => {
    pizzas.findBy.mockResolvedValue([
      { prices: [{ sizeId: size.id, price: 30 }] },
    ]);
    await expect(
      service.update(1, { pizzaSizes: [{ name: 'Nova' }] }),
    ).rejects.toThrow(ConflictException);
    await expect(service.update(1, { isPizza: false })).rejects.toThrow(
      ConflictException,
    );
    expect(categories.save).not.toHaveBeenCalled();
  });
  it('allows renaming a priced size without rewriting prices', async () => {
    pizzas.findBy.mockResolvedValue([
      { prices: [{ sizeId: size.id, price: 30 }] },
    ]);
    expect(
      await service.update(1, {
        pizzaSizes: [{ ...size, name: 'Gigante do dia' }],
      }),
    ).toMatchObject({ pizzaSizes: [{ ...size, name: 'Gigante do dia' }] });
  });
  it('rejects converting categories with ordinary products', async () => {
    categories.findOne.mockResolvedValue({
      id: 1,
      isPizza: false,
      pizzaSizes: [],
    });
    products.countBy.mockResolvedValue(1);
    await expect(
      service.update(1, {
        isPizza: true,
        pizzaSizes: [{ name: 'Grande' }],
        maxFlavors: 2,
        pricingRule: PizzaPricingRule.HIGHEST,
      }),
    ).rejects.toThrow(ConflictException);
  });
  it('reports absent categories', async () => {
    categories.findOne.mockResolvedValue(null);
    await expect(service.update(9, { name: 'Inexistente' })).rejects.toThrow(
      NotFoundException,
    );
  });
});
