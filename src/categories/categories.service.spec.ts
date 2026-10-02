import { OptionalGroup } from '../optionals/entities/optional-group.entity';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CategoriesService } from './categories.service';
import { Category } from './entities/category.entity';
import { Product } from '../products/entities/product.entity';
import { PizzaPricingRule } from './model/pizza-settings';
import { PizzaCategoryCombination } from './entities/pizza-category-combination.entity';
import { combinationIds } from './pizza-combinations';
describe('CategoriesService', () => {
  const size = { id: 'e77c3e55-f128-489d-8412-3d5bffb92edb', name: 'Grande' };
  let service: CategoriesService;
  let categories: any;
  let products: any;
  let pizzas: any;
  let optionals: any;
  let combinations: any;
  beforeEach(() => {
    categories = {
      create: jest.fn((v) => ({ ...v })),
      save: jest.fn(async (v) => ({ id: 1, ...v })),
      findBy: jest.fn(async () => [{ id: 2, isPizza: true, maxFlavors: 2 }]),
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
    pizzas = {
      findBy: jest.fn(async () => []),
      update: jest.fn(async () => ({})),
    };
    optionals = { findBy: jest.fn(async () => []) };
    combinations = {
      find: jest.fn(async () => []),
      delete: jest.fn(async () => ({})),
      create: jest.fn((v) => v),
      save: jest.fn(async (v) => v),
    };
    const manager = {
      query: jest.fn(async () => []),
      getRepository: (type: any) =>
        type === PizzaCategoryCombination
          ? combinations
          : type === Category
            ? categories
            : type === Product
              ? products
              : type === OptionalGroup
                ? optionals
                : pizzas,
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
  it('saves ordinary category icons and forces pizza icons for pizza categories', async () => {
    expect(
      await service.create({ name: 'Sucos', icon: 'juice' }),
    ).toMatchObject({ icon: 'juice', isPizza: false });
    expect(await service.update(1, { icon: 'juice' })).toMatchObject({
      icon: 'pizza',
      isPizza: true,
    });
  });
  it('removes size prices from all flavors and rejects converting a pizza category', async () => {
    pizzas.findBy.mockResolvedValue([
      { id: 1, prices: [{ sizeId: size.id, price: 30 }] },
      { id: 2, prices: [{ sizeId: size.id, price: 45 }] },
    ]);
    await service.update(1, { pizzaSizes: [{ name: 'Nova' }] });
    expect(pizzas.update).toHaveBeenCalledWith(1, { prices: [] });
    expect(pizzas.update).toHaveBeenCalledWith(2, { prices: [] });
    categories.save.mockClear();
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
  it('protects sizes and category types used by optional groups', async () => {
    optionals.findBy.mockResolvedValue([
      { items: [{ sizePrices: [{ sizeId: size.id, price: 5 }] }] },
    ]);
    await expect(
      service.update(1, { pizzaSizes: [{ name: 'Nova' }] }),
    ).rejects.toThrow(ConflictException);
    await expect(service.update(1, { isPizza: false })).rejects.toThrow(
      ConflictException,
    );
    expect(
      await service.update(1, { pizzaSizes: [{ ...size, name: 'Renomeado' }] }),
    ).toMatchObject({ pizzaSizes: [{ ...size, name: 'Renomeado' }] });
  });
  it('reports absent categories', async () => {
    categories.findOne.mockResolvedValue(null);
    await expect(service.update(9, { name: 'Inexistente' })).rejects.toThrow(
      NotFoundException,
    );
  });
  it('stores canonical reciprocal links and preserves them in partial updates', async () => {
    expect(
      await service.update(1, { compatibleCategoryIds: [2] }),
    ).toMatchObject({ compatibleCategoryIds: [2] });
    expect(combinations.save).toHaveBeenCalledWith([
      { categoryId: 1, compatibleCategoryId: 2 },
    ]);
    combinations.find.mockResolvedValue([
      { categoryId: 1, compatibleCategoryId: 2 },
    ]);
    expect(await service.update(1, { name: 'Salgadas' })).toMatchObject({
      compatibleCategoryIds: [2],
    });
    const pairs = [
      { categoryId: 1, compatibleCategoryId: 2 },
      { categoryId: 2, compatibleCategoryId: 3 },
    ] as PizzaCategoryCombination[];
    expect(combinationIds(1, pairs)).toEqual([2]);
    expect(combinationIds(2, pairs)).toEqual([1, 3]);
    expect(combinationIds(3, pairs)).toEqual([2]);
  });
  it('clears reciprocal links when reduced to one flavor and rejects invalid targets', async () => {
    expect(
      await service.update(1, { maxFlavors: 1, compatibleCategoryIds: [2] }),
    ).toMatchObject({ compatibleCategoryIds: [] });
    expect(combinations.delete).toHaveBeenCalledWith([
      { categoryId: 1 },
      { compatibleCategoryId: 1 },
    ]);
    expect(combinations.save).not.toHaveBeenCalled();
    await expect(
      service.update(1, { compatibleCategoryIds: [1] }),
    ).rejects.toThrow('própria categoria');
    categories.findBy.mockResolvedValue([{ id: 2, isPizza: false }]);
    await expect(
      service.update(1, { compatibleCategoryIds: [2] }),
    ).rejects.toThrow('Combine apenas');
    categories.findBy.mockResolvedValue([]);
    await expect(
      service.update(1, { compatibleCategoryIds: [99] }),
    ).rejects.toThrow('Combine apenas');
  });
});
