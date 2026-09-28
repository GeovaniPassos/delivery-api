import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import type { OptionalKind, OptionalScope } from '../model/optional.model';
export class OptionalSizePriceDto {
  @IsUUID() sizeId!: string;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(99999999.99) price!: number;
}
export class OptionalItemDto {
  @ValidateIf((_, v) => v !== undefined) @IsUUID() id?: string;
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 120)
  name!: string;
  @ValidateIf((_, v) => v !== null)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99999999.99)
  price!: number | null;
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique((v: OptionalSizePriceDto) => v.sizeId)
  @ValidateNested({ each: true })
  @Type(() => OptionalSizePriceDto)
  sizePrices!: OptionalSizePriceDto[];
}
export class CreateOptionalGroupDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(2, 120)
  name!: string;
  @IsIn(['general', 'pizza-extra', 'pizza-crust']) kind!: OptionalKind;
  @IsIn(['category', 'products']) scope!: OptionalScope;
  @ValidateIf((_, v) => v !== null) @IsInt() @Min(1) categoryId!: number | null;
  @IsArray()
  @ArrayMaxSize(500)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  productIds!: number[];
  @IsBoolean() quantitative!: boolean;
  @IsInt() @Min(0) @Max(100) maxTotal!: number;
  @IsInt() @Min(0) @Max(100) maxPerOption!: number;
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => OptionalItemDto)
  items!: OptionalItemDto[];
}
