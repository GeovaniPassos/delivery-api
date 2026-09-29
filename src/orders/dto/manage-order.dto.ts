import { Type } from 'class-transformer';
import { IsIn, IsInt, Max, Min } from 'class-validator';
import { orderStatuses } from '../model/order-status';
import type { OrderStatus } from '../model/order-status';
export class ListOrdersDto {
  @IsIn(['placed', 'preparing', 'waiting', 'completed']) group:
    | 'placed'
    | 'preparing'
    | 'waiting'
    | 'completed' = 'placed';
  @Type(() => Number) @IsInt() @Min(1) @Max(1000000) page = 1;
}
export class AdvanceOrderDto {
  @IsIn(orderStatuses) expectedStatus!: OrderStatus;
}
