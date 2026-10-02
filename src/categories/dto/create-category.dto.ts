import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { PizzaPricingRule } from '../model/pizza-settings';
import { categoryIcons } from '../model/category-icon';
import type { CategoryIcon } from '../model/category-icon';
export class PizzaSizeDto {
  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(1)
  @Max(20)
  maxFlavors?: number;
  @ValidateIf((_, value) => value !== undefined) @IsUUID() id?: string;
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 60)
  name!: string;
}
export class CreateCategoryDto {
  @ValidateIf((_, v) => v !== undefined)
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  compatibleCategoryIds?: number[];
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(2, 60)
  name!: string;
  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  availableDays?: number[];
  @ValidateIf((_, value) => value !== undefined) @IsBoolean() isPizza?: boolean;
  @ValidateIf((_, value) => value !== undefined)
  @IsIn(categoryIcons)
  icon?: CategoryIcon;
  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => PizzaSizeDto)
  pizzaSizes?: PizzaSizeDto[];
  @IsOptional() @IsInt() @Min(1) @Max(20) maxFlavors?: number | null;
  @IsOptional() @IsEnum(PizzaPricingRule) pricingRule?: PizzaPricingRule | null;
}
