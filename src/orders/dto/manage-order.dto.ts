import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  Max,
  Min,
  IsOptional,
  IsString,
  MaxLength,
  Matches,
  IsDateString,
} from 'class-validator';
import { orderStatuses } from '../model/order-status';
import type { OrderStatus } from '../model/order-status';
export class ListOrdersDto {
  @IsIn(['placed', 'preparing', 'waiting', 'completed', 'all']) group:
    | 'all'
    | 'placed'
    | 'preparing'
    | 'waiting'
    | 'completed' = 'placed';
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  date?: string;
  @IsOptional() @IsIn(['pickup', 'delivery']) fulfillment?:
    | 'pickup'
    | 'delivery';
  @Type(() => Number) @IsInt() @Min(1) @Max(1000000) page = 1;
}
export class AdvanceOrderDto {
  @IsIn(orderStatuses) expectedStatus!: OrderStatus;
}
