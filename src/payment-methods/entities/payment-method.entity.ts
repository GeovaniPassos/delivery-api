import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
export type PaymentType = 'cash' | 'card' | 'pix' | 'other';
@Entity('payment_methods')
@Index('payment_standard_type_unique', ['type'], {
  unique: true,
  where: `"type" <> 'other'`,
})
export class PaymentMethod {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'varchar', length: 10 }) type!: PaymentType;
  @Column({ type: 'varchar', length: 120, nullable: true }) name!:
    | string
    | null;
  @Column({ default: true }) active!: boolean;
  @Column({ type: 'varchar', length: 200, nullable: true }) pixKey!:
    | string
    | null;
  @Column({ type: 'varchar', length: 120, nullable: true }) holderName!:
    | string
    | null;
  @Column({ type: 'text', default: '' }) description!: string;
}
