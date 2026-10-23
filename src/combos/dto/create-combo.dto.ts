import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayUnique, IsArray, IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Length, Max, MaxLength, Min, ValidateNested } from 'class-validator';

class ComboOptionalDto {
  @IsString() @Length(1, 100) name!: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(99999999.99) price!: number;
}

class ComboProductPriceDto {
  @Type(() => Number) @IsInt() @Min(1) productId!: number;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(99999999.99) price!: number;
}

export class CreateComboDto {
  @IsString() @Length(2, 120) name!: string;
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(99999999.99) price!: number;
  @IsArray() @ArrayMaxSize(100) @ArrayUnique() @IsInt({ each: true }) @Min(1, { each: true }) categoryIds!: number[];
  @IsArray() @ArrayMaxSize(100) @ArrayUnique() @IsInt({ each: true }) @Min(1, { each: true }) productIds!: number[];
  @IsOptional() @IsArray() @ArrayMaxSize(100) @ArrayUnique((item: ComboProductPriceDto) => item.productId) @ValidateNested({ each: true }) @Type(() => ComboProductPriceDto) productPrices?: ComboProductPriceDto[];
  @IsBoolean() allowHalfAndHalf!: boolean;
  @Type(() => Number) @IsInt() @Min(1) @Max(4) maxPizzaFlavors!: number;
  @IsBoolean() optionalsEnabled!: boolean;
  @IsIn(['category', 'custom']) optionalSource!: 'category' | 'custom';
  @IsBoolean() optionalsRequired!: boolean;
  @IsBoolean() allowMultipleOptionals!: boolean;
  @IsArray() @ValidateNested({ each: true }) @Type(() => ComboOptionalDto) customOptionals!: ComboOptionalDto[];
  @IsBoolean() active!: boolean;
}
