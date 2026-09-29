import { Body, Controller, Get, Header, Patch } from '@nestjs/common';
import { StoreSettingsService } from './store-settings.service';
import {
  UpdateEstimatesDto,
  UpdateStoreStatusDto,
} from './dto/update-store-settings.dto';
@Controller('store-settings')
export class StoreSettingsController {
  constructor(private readonly service: StoreSettingsService) {}
  @Get() @Header('Cache-Control', 'no-store') get() {
    return this.service.get();
  }
  @Patch('status') status(@Body() dto: UpdateStoreStatusDto) {
    return this.service.status(dto);
  }
  @Patch('estimates') estimates(@Body() dto: UpdateEstimatesDto) {
    return this.service.estimates(dto);
  }
}
