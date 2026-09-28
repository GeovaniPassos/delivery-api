import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from '../categories/entities/category.entity';
import { Product } from '../products/entities/product.entity';
import { OptionalGroup } from './entities/optional-group.entity';
import { OptionalsController } from './optionals.controller';
import { OptionalsService } from './optionals.service';
@Module({
  imports: [TypeOrmModule.forFeature([OptionalGroup, Category, Product])],
  controllers: [OptionalsController],
  providers: [OptionalsService],
})
export class OptionalsModule {}
