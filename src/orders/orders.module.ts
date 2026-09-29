import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { Product } from '../products/entities/product.entity';
import { Pizza } from '../pizzas/entities/pizza.entity';
import { Category } from '../categories/entities/category.entity';
import { OptionalGroup } from '../optionals/entities/optional-group.entity';
import { Neighborhood } from '../neighborhoods/entities/neighborhood.entity';
import { PaymentMethod } from '../payment-methods/entities/payment-method.entity';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order,
      Product,
      Pizza,
      Category,
      OptionalGroup,
      Neighborhood,
      PaymentMethod,
    ]),
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
