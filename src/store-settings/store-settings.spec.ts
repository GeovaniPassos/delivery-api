import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Repository } from 'typeorm';
import { StoreSettings } from './entities/store-settings.entity';
import { StoreSettingsService } from './store-settings.service';
import {
  UpdateEstimatesDto,
  UpdateStoreStatusDto,
} from './dto/update-store-settings.dto';
import { CreateCategoryDto } from '../categories/dto/create-category.dto';
import { categoryIcons } from '../categories/model/category-icon';
describe('Store settings', () => {
  it('validates explicit status and positive integer minute estimates', async () => {
    expect(
      await validate(plainToInstance(UpdateStoreStatusDto, { isOpen: false })),
    ).toEqual([]);
    expect(
      await validate(
        plainToInstance(UpdateStoreStatusDto, { isOpen: 'false' }),
      ),
    ).not.toEqual([]);
    expect(
      await validate(
        plainToInstance(UpdateEstimatesDto, {
          deliveryMinutes: 45,
          pickupMinutes: 20,
        }),
      ),
    ).toEqual([]);
    for (const invalid of [0, -1, 1.5, 1441, null])
      expect(
        await validate(
          plainToInstance(UpdateEstimatesDto, {
            deliveryMinutes: invalid,
            pickupMinutes: 20,
          }),
        ),
      ).not.toEqual([]);
  });
  it('updates opening and estimates independently and keeps configuration on startup', async () => {
    const settings = {
      id: 1,
      isOpen: false,
      deliveryMinutes: 45,
      pickupMinutes: 20,
    };
    const builder = {
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      orIgnore: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({}),
    };
    const repo = {
      createQueryBuilder: () => builder,
      findOneByOrFail: () => Promise.resolve(settings),
      update: jest.fn((_id, value) => {
        Object.assign(settings, value);
        return Promise.resolve({ affected: 1 });
      }),
    };
    const service = new StoreSettingsService(
      repo as unknown as Repository<StoreSettings>,
    );
    await service.onModuleInit();
    expect(builder.orIgnore).toHaveBeenCalled();
    expect(settings.isOpen).toBe(false);
    await service.estimates({ deliveryMinutes: 60, pickupMinutes: 30 });
    expect(settings.isOpen).toBe(false);
    await service.status({ isOpen: true });
    expect(settings).toMatchObject({
      isOpen: true,
      deliveryMinutes: 60,
      pickupMinutes: 30,
    });
  });
  it('accepts only the seven supported category icons', async () => {
    for (const icon of categoryIcons)
      expect(
        await validate(
          plainToInstance(CreateCategoryDto, { name: 'Categoria', icon }),
        ),
      ).toEqual([]);
    for (const icon of ['unknown', '🍔', null])
      expect(
        await validate(
          plainToInstance(CreateCategoryDto, { name: 'Categoria', icon }),
        ),
      ).not.toEqual([]);
  });
});
