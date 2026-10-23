import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from '../categories/entities/category.entity';
import { Product } from '../products/entities/product.entity';
import { Combo } from './entities/combo.entity';
import { CombosController } from './combos.controller';
import { CombosService } from './combos.service';

@Module({
  imports: [TypeOrmModule.forFeature([Combo, Category, Product])],
  controllers: [CombosController],
  providers: [CombosService],
})
export class CombosModule {}
