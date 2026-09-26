import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Pizza } from './entities/pizza.entity';
import { PizzasService } from './pizzas.service';
describe('PizzasService', () => {
  const sizeId = 'e77c3e55-f128-489d-8412-3d5bffb92edb';
  const dto = {
    name: 'Mussarela',
    categoryId: 1,
    prices: [{ sizeId, price: 40, promotionalPrice: 30 }],
    availableDays: [1, 2],
  };
  let repo: any;
  let categories: any;
  let service: PizzasService;
  beforeEach(() => {
    repo = {
      create: jest.fn((v) => v),
      save: jest.fn(async (v) => v),
      findOne: jest.fn(async () => ({ id: 1, ...dto })),
      find: jest.fn(async () => [{ id: 1 }, { id: 2 }]),
      update: jest.fn(),
      delete: jest.fn(),
    };
    categories = {
      findOne: jest.fn(async () => ({
        id: 1,
        isPizza: true,
        pizzaSizes: [{ id: sizeId, name: 'Grande' }],
      })),
    };
    const manager = {
      getRepository: (entity: any) => (entity === Pizza ? repo : categories),
    };
    service = new PizzasService({
      getRepository: manager.getRepository,
      transaction: (fn: any) => fn(manager),
    } as unknown as DataSource);
  });
  it('saves every field in a separate pizza entity', async () => {
    expect(
      await service.create({
        ...dto,
        available: false,
        photo: 'https://example.com/pizza.jpg',
      }),
    ).toMatchObject({
      ...dto,
      available: false,
      photo: 'https://example.com/pizza.jpg',
    });
  });
  it('requires pizza categories and exactly the sizes belonging to them', async () => {
    categories.findOne.mockResolvedValueOnce({ isPizza: false });
    await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    await expect(service.create({ ...dto, prices: [] })).rejects.toThrow(
      BadRequestException,
    );
    await expect(
      service.create({ ...dto, prices: [{ sizeId: 'other', price: 40 }] }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.create({ ...dto, prices: [dto.prices[0], dto.prices[0]] }),
    ).rejects.toThrow(BadRequestException);
    expect(repo.save).not.toHaveBeenCalled();
  });
  it('rejects invalid promotions and clears optional promotions', async () => {
    await expect(
      service.update(1, {
        prices: [{ sizeId, price: 20, promotionalPrice: 30 }],
      }),
    ).rejects.toThrow(BadRequestException);
    expect(
      await service.update(1, {
        prices: [{ sizeId, price: 40, promotionalPrice: null }],
        photo: null,
      }),
    ).toMatchObject({
      prices: [{ sizeId, price: 40, promotionalPrice: null }],
      photo: null,
    });
  });
  it('updates only selected flavors, in one transaction', async () => {
    expect(await service.availability([1, 2], false)).toEqual({
      ids: [1, 2],
      available: false,
    });
    expect(repo.update).toHaveBeenCalledWith(expect.anything(), {
      available: false,
    });
  });
  it('does not partially update or delete when any selected flavor is missing', async () => {
    repo.find.mockResolvedValue([{ id: 1 }]);
    await expect(service.availability([1, 2], false)).rejects.toThrow(
      NotFoundException,
    );
    await expect(service.remove([1, 2])).rejects.toThrow(NotFoundException);
    expect(repo.update).not.toHaveBeenCalled();
    expect(repo.delete).not.toHaveBeenCalled();
  });
  it('deletes the selected IDs together', async () => {
    expect(await service.remove([1, 2])).toEqual({ ids: [1, 2] });
    expect(repo.delete).toHaveBeenCalledTimes(1);
  });
});
