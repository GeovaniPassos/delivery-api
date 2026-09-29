import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StoreSettings } from './entities/store-settings.entity';
import {
  UpdateEstimatesDto,
  UpdateStoreStatusDto,
} from './dto/update-store-settings.dto';
@Injectable()
export class StoreSettingsService implements OnModuleInit {
  constructor(
    @InjectRepository(StoreSettings)
    private readonly repo: Repository<StoreSettings>,
  ) {}
  async onModuleInit() {
    // Preserve existing settings when the API restarts or multiple instances start.
    await this.repo
      .createQueryBuilder()
      .insert()
      .values({
        id: 1,
        isOpen: true,
        deliveryMinutes: null,
        pickupMinutes: null,
      })
      .orIgnore()
      .execute();
  }
  get() {
    return this.repo.findOneByOrFail({ id: 1 });
  }
  async status(dto: UpdateStoreStatusDto) {
    await this.repo.update(1, { isOpen: dto.isOpen });
    return this.get();
  }
  async estimates(dto: UpdateEstimatesDto) {
    await this.repo.update(1, {
      deliveryMinutes: dto.deliveryMinutes,
      pickupMinutes: dto.pickupMinutes,
    });
    return this.get();
  }
}
