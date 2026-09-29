import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsString,
  Length,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import type { PaymentType } from '../entities/payment-method.entity';
export class SavePaymentMethodDto {
  @IsIn(['cash', 'card', 'pix']) type!: PaymentType;
  @IsBoolean() active!: boolean;
  @ValidateIf((o) => o.type === 'pix')
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 200)
  pixKey?: string;
  @ValidateIf((o) => o.type === 'pix')
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(2, 120)
  holderName?: string;
  @ValidateIf((_, v) => v !== undefined)
  @IsString()
  @MaxLength(1000)
  description?: string;
}
