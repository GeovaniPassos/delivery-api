import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
export type PaymentType = 'cash' | 'card' | 'pix';
@Entity('payment_methods')
export class PaymentMethod {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'varchar', length: 10, unique: true }) type!: PaymentType;
  @Column({ default: true }) active!: boolean;
  @Column({ type: 'varchar', length: 200, nullable: true }) pixKey!:
    | string
    | null;
  @Column({ type: 'varchar', length: 120, nullable: true }) holderName!:
    | string
    | null;
  @Column({ type: 'text', default: '' }) description!: string;
}
