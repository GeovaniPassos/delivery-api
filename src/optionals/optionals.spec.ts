import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreateOptionalGroupDto } from './dto/create-optional-group.dto';
import { validateOptionalGroup } from './optional-rules';
import { OptionalGroup } from './entities/optional-group.entity';
import { Category } from '../categories/entities/category.entity';
import { Product } from '../products/entities/product.entity';
import { OptionalsService } from './optionals.service';
const sizeId = 'e77c3e55-f128-489d-8412-3d5bffb92edb';
const itemId = 'c4b242dd-cd8a-4313-a658-05e9c7a06598';
const category = { id: 1, isPizza: false, pizzaSizes: [] } as Category;
const pizzaCategory = {
  ...category,
  isPizza: true,
  pizzaSizes: [{ id: sizeId, name: 'Grande' }],
};
const valid: CreateOptionalGroupDto = {
  name: 'Adicionais',
  kind: 'general',
  scope: 'category',
  categoryId: 1,
  productIds: [],
  quantitative: true,
  maxTotal: 5,
  maxPerOption: 2,
  items: [{ name: 'Cheddar', price: 3.5, sizePrices: [] }],
};
describe('Optional DTO', () => {
  it('accepts free items and trims names', async () => {
    const dto = plainToInstance(CreateOptionalGroupDto, {
      ...valid,
      name: ' Extras ',
      items: [{ name: ' Molho ', price: 0, sizePrices: [] }],
    });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.items[0].name).toBe('Molho');
  });
  it.each([
    { maxTotal: -1 },
    { maxTotal: 1.5 },
    { maxPerOption: 101 },
    { productIds: [1, 1] },
    { categoryId: undefined },
    { items: [{ name: ' ', price: 2, sizePrices: [] }] },
    { items: [{ name: 'Cheddar', price: 1.234, sizePrices: [] }] },
    { items: [{ name: 'Cheddar', price: -1, sizePrices: [] }] },
    {
      items: [
        {
          name: 'Borda',
          price: null,
          sizePrices: [
            { sizeId, price: 2 },
            { sizeId, price: 3 },
          ],
        },
      ],
    },
  ])('rejects invalid fields %j', async (fields) => {
    expect(
      (
        await validate(
          plainToInstance(CreateOptionalGroupDto, { ...valid, ...fields }),
        )
      ).length,
    ).toBeGreaterThan(0);
  });
});
describe('Optional rules', () => {
  it('assigns stable item IDs and preserves existing IDs', () => {
    const [item] = validateOptionalGroup(valid, category, []);
    expect(item.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(
      validateOptionalGroup({ ...valid, items: [item] }, category, [], {
        items: [item],
      } as OptionalGroup)[0].id,
    ).toBe(item.id);
  });
  it('validates category and selected product associations', () => {
    expect(() => validateOptionalGroup(valid, pizzaCategory, [])).toThrow(
      BadRequestException,
    );
    expect(() => validateOptionalGroup(valid, null, [])).toThrow(
      BadRequestException,
    );
    const dto = {
      ...valid,
      scope: 'products' as const,
      categoryId: null,
      productIds: [2],
    };
    expect(() => validateOptionalGroup(dto, null, [])).toThrow(
      BadRequestException,
    );
    expect(
      validateOptionalGroup(dto, null, [{ id: 2, category } as Product]),
    ).toHaveLength(1);
    expect(() =>
      validateOptionalGroup({ ...dto, kind: 'pizza-extra' }, null, [
        { id: 2, category } as Product,
      ]),
    ).toThrow(BadRequestException);
  });
  it('uses zero as unlimited total or per-option quantity', () => {
    expect(
      validateOptionalGroup(
        { ...valid, maxTotal: 0, maxPerOption: 8 },
        category,
        [],
      ),
    ).toHaveLength(1);
    expect(
      validateOptionalGroup(
        { ...valid, maxTotal: 0, maxPerOption: 0 },
        category,
        [],
      ),
    ).toHaveLength(1);
    expect(
      validateOptionalGroup(
        { ...valid, maxTotal: 5, maxPerOption: 0 },
        category,
        [],
      ),
    ).toHaveLength(1);
  });
  it('enforces total and repeated-item limits', () => {
    expect(() =>
      validateOptionalGroup({ ...valid, maxPerOption: 6 }, category, []),
    ).toThrow(BadRequestException);
    expect(() =>
      validateOptionalGroup({ ...valid, quantitative: false }, category, []),
    ).toThrow(BadRequestException);
    expect(
      validateOptionalGroup(
        { ...valid, quantitative: false, maxPerOption: 1 },
        category,
        [],
      ),
    ).toHaveLength(1);
  });
  it('requires border prices to belong to the pizza category', () => {
    const dto: CreateOptionalGroupDto = {
      ...valid,
      kind: 'pizza-crust',
      quantitative: false,
      maxTotal: 1,
      maxPerOption: 1,
      items: [
        { name: 'Cheddar', price: null, sizePrices: [{ sizeId, price: 7 }] },
      ],
    };
    expect(validateOptionalGroup(dto, pizzaCategory, [])[0].sizePrices).toEqual(
      [{ sizeId, price: 7 }],
    );
    expect(() =>
      validateOptionalGroup(
        { ...dto, items: [{ ...dto.items[0], sizePrices: [] }] },
        pizzaCategory,
        [],
      ),
    ).toThrow(BadRequestException);
    expect(() =>
      validateOptionalGroup(
        {
          ...dto,
          items: [
            { ...dto.items[0], sizePrices: [{ sizeId: itemId, price: 7 }] },
          ],
        },
        pizzaCategory,
        [],
      ),
    ).toThrow(BadRequestException);
  });
  it('rejects duplicate names and foreign item IDs', () => {
    expect(() =>
      validateOptionalGroup(
        {
          ...valid,
          items: [valid.items[0], { ...valid.items[0], name: 'CHEDDAR' }],
        },
        category,
        [],
      ),
    ).toThrow(BadRequestException);
    expect(() =>
      validateOptionalGroup(
        { ...valid, items: [{ ...valid.items[0], id: itemId }] },
        category,
        [],
      ),
    ).toThrow(BadRequestException);
  });
});
describe('Optional persistence', () => {
  let repo: any;
  let service: OptionalsService;
  beforeEach(() => {
    repo = {
      create: jest.fn((v) => v),
      save: jest.fn(async (v) => ({ ...v, id: v.id ?? 1 })),
      findOne: jest.fn(),
      remove: jest.fn(),
      find: jest.fn(),
    };
    const manager = {
      getRepository: (entity: unknown) =>
        entity === OptionalGroup
          ? repo
          : entity === Category
            ? { findOne: jest.fn(async () => category) }
            : { find: jest.fn(async () => [{ id: 2, category }]) },
    };
    service = new OptionalsService({
      getRepository: manager.getRepository,
      transaction: (fn: any) => fn(manager),
    } as unknown as DataSource);
  });
  it('creates and updates groups with product links and ordered items', async () => {
    const created = await service.create({
      ...valid,
      scope: 'products',
      categoryId: null,
      productIds: [2],
    });
    expect(created.productIds).toEqual([2]);
    repo.findOne.mockResolvedValue(created);
    expect(
      (await service.update(1, { ...valid, items: created.items })).productIds,
    ).toEqual([]);
    expect((await service.update(1, { ...valid, items: [] })).items).toEqual(
      [],
    );
  });
  it('rejects missing groups and removes group links through the ORM', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(service.update(9, valid)).rejects.toThrow(NotFoundException);
    await expect(service.remove(9)).rejects.toThrow(NotFoundException);
    const group = { id: 1, products: [{ id: 2 }] };
    repo.findOne.mockResolvedValue(group);
    await service.remove(1);
    expect(repo.remove).toHaveBeenCalledWith(group);
  });
});
