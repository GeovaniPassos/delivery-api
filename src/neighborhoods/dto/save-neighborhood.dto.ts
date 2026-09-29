import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
export class SaveNeighborhoodDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(2, 120)
  name!: string;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(99999999.99) fee!: number;
  @IsBoolean() active!: boolean;
}
