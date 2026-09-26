import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from '../categories/entities/category.entity';
import { Pizza } from './entities/pizza.entity';
import { PizzasController } from './pizzas.controller';
import { PizzasService } from './pizzas.service';
@Module({
  imports: [TypeOrmModule.forFeature([Pizza, Category])],
  controllers: [PizzasController],
  providers: [PizzasService],
})
export class PizzasModule {}
