import { IsBoolean, IsInt, Max, Min } from 'class-validator';
export class UpdateStoreStatusDto {
  @IsBoolean() isOpen!: boolean;
}
export class UpdateEstimatesDto {
  @IsInt() @Min(1) @Max(1440) deliveryMinutes!: number;
  @IsInt() @Min(1) @Max(1440) pickupMinutes!: number;
}
