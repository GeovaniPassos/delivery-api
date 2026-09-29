import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDefined,
  IsIn,
  IsInt,
  IsNumber,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
export class OrderOptionalDto {
  @IsInt() @Min(1) groupId!: number;
  @IsUUID() itemId!: string;
  @IsInt() @Min(1) @Max(Number.MAX_SAFE_INTEGER) quantity!: number;
}
export class OrderFlavorDto {
  @IsInt() @Min(1) pizzaId!: number;
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsString({ each: true })
  @Length(1, 120, { each: true })
  removedIngredients: string[] = [];
}
export class OrderItemDto {
  @IsIn(['product', 'pizza']) type!: 'product' | 'pizza';
  @IsInt() @Min(1) @Max(99) quantity!: number;
  @ValidateIf((o) => o.type === 'product') @IsInt() @Min(1) productId?: number;
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsString({ each: true })
  @Length(1, 120, { each: true })
  removedIngredients: string[] = [];
  @ValidateIf((o) => o.type === 'pizza') @IsInt() @Min(1) categoryId?: number;
  @ValidateIf((o) => o.type === 'pizza') @IsUUID() sizeId?: string;
  @ValidateIf((o) => o.type === 'pizza')
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ArrayUnique((f: OrderFlavorDto) => f.pizzaId)
  @ValidateNested({ each: true })
  @Type(() => OrderFlavorDto)
  flavors?: OrderFlavorDto[];
  @IsArray()
  @ArrayMaxSize(200)
  @ArrayUnique((o: OrderOptionalDto) => o.groupId + ':' + o.itemId)
  @ValidateNested({ each: true })
  @Type(() => OrderOptionalDto)
  optionals: OrderOptionalDto[] = [];
}
export class QuoteOrderDto {
  @IsIn(['pickup', 'delivery']) fulfillment!: 'pickup' | 'delivery';
  @ValidateIf((o) => o.fulfillment === 'delivery')
  @IsInt()
  @Min(1)
  neighborhoodId?: number;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];
}
export class DeliveryAddressDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(2, 180)
  street!: string;
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 20)
  number!: string;
  @ValidateIf((_, v) => v !== undefined && v !== '')
  @IsString()
  @Matches(/^\d{5}-?\d{3}$/)
  postalCode?: string;
}
export class CreateOrderDto extends QuoteOrderDto {
  @IsUUID() requestId!: string;
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(2, 120)
  customerName!: string;
  @Transform(({ value }) =>
    typeof value === 'string' ? value.replace(/[^\d]/g, '') : value,
  )
  @IsString()
  @Matches(/^(?:55)?\d{10,11}$/)
  phone!: string;
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99999999.99)
  expectedTotal!: number;
  @ValidateIf((o) => o.fulfillment === 'delivery')
  @IsDefined()
  @ValidateNested()
  @Type(() => DeliveryAddressDto)
  address?: DeliveryAddressDto;
  @ValidateIf((o) => o.fulfillment === 'delivery')
  @IsInt()
  @Min(1)
  paymentMethodId?: number;
  @ValidateIf((o) => o.fulfillment === 'delivery')
  @IsBoolean()
  needsChange?: boolean;
  @ValidateIf((o) => o.fulfillment === 'delivery' && o.needsChange === true)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99999999.99)
  changeFor?: number;
}
