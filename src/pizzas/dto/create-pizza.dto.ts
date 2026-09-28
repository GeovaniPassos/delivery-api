import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
export class PizzaPriceDto {
  @IsUUID() sizeId!: string;
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99999999.99)
  price!: number;
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99999999.99)
  promotionalPrice?: number | null;
}
export class CreatePizzaDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(2, 120)
  name!: string;
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MaxLength(5000)
  description?: string;
  @Transform(({ value }) =>
    Array.isArray(value)
      ? value.map((item) => (typeof item === 'string' ? item.trim() : item))
      : value,
  )
  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique((item: unknown) =>
    typeof item === 'string' ? item.toLocaleLowerCase('pt-BR') : item,
  )
  @IsString({ each: true })
  @Length(1, 120, { each: true })
  ingredients?: string[];
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2048)
  photo?: string | null;
  @IsInt() @Min(1) categoryId!: number;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ArrayUnique((price: PizzaPriceDto) => price.sizeId)
  @ValidateNested({ each: true })
  @Type(() => PizzaPriceDto)
  prices!: PizzaPriceDto[];
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  availableDays!: number[];
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  available?: boolean;
}
