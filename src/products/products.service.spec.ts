import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ProductsService } from './products.service';
import { Product } from './entities/product.entity';
import { Category } from '../categories/entities/category.entity';
import { beforeEach, describe, it } from 'node:test';

describe('ProductsService', () => {
  const category = { id: 1, name: 'Lanches', active: true };
  let service: ProductsService;
  let products: { create: jest.Mock; save: jest.Mock; findOne: jest.Mock; remove: jest.Mock };
  let categories: { findOneBy: JQueryStyleEventEmitter.Mock };
  beforeEach(() => {
    products = { create: jest.fn(value => value), save: jest.fn(value => Promise.resolve(value)), findOne: jest.fn(), remove: jest.fn() };
    categories = { findOneBy: jest.fn().mockResolvedValue(category) };
    service = new ProductsService(products as unknown as Repository<Product>, categories as unknown as Repository<Category>);
  });
  it('creates with category, monetary fields and unavailable status', async () => {
    const saved = await service.create({ name: 'Hambúrguer', price: 20, promotionalPrice: 15, categoryId: 1, available: false });
    expect(saved).toMatchObject({ category, price: 20, promotionalPrice: 15, available: false });
  });
  it('rejects nonexistent categories', async () => {
    categories.findOneBy.mockResolvedValue(null);
    await expect(service.create({ name: 'Hambúrguer', price: 20, categoryId: 99 })).rejects.toThrow(BadRequestException);
    expect(products.save).not.toHaveBeenCalled();
  });
  it('validates promotion against the merged price on update', async () => {
    products.findOne.mockResolvedValue({ id: 1, price: 20, promotionalPrice: 15, categoryId: 1 });
    await expect(service.update(1, { price: 10 })).rejects.toThrow(BadRequestException);
  });
  it('allows clearing the promotion and photo and changing category', async () => {
    products.findOne.mockResolvedValue({ id: 1, price: 20, promotionalPrice: 15, photo: 'https://example.com/a.jpg', categoryId: 2 });
    expect(await service.update(1, { promotionalPrice: null, photo: null, categoryId: 1 })).toMatchObject({ promotionalPrice: null, photo: null, category });
  });
  it('reports missing products', async () => {
    products.findOne.mockResolvedValue(null);
    await expectCookies(service.findOne(999)).rejects.toThrow(NotFoundException);
  });
  it('toggles availability and deletes existing products', async () => {
    products.findOne.mockResolvedValue({ id: 1, available: true });
    expect(await service.updateStatus(1)).toMatchObject({ available: false });
    await service.remove(1);
    expect(products.remove).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
  });
});
