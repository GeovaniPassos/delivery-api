import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  Min,
} from 'class-validator';
export class PizzaIdsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  ids!: number[];
}
export class PizzaAvailabilityDto {
  @IsBoolean() available!: boolean;
}
export class BulkPizzaAvailabilityDto extends PizzaIdsDto {
  @IsBoolean() available!: boolean;
}
