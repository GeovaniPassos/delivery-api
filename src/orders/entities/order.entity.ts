import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { OrderLineSnapshot, OrderPayment } from '../model/order.model';
@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'uuid', unique: true }) requestId!: string;
  @Column({ length: 64 }) requestHash!: string;
  @Column({ type: 'varchar', length: 64, nullable: true, unique: true })
  trackingToken!: string | null;
  @Column({ length: 120 }) customerName!: string;
  @Column({ length: 13 }) phone!: string;
  @Column({ type: 'varchar', length: 10 }) fulfillment!: 'pickup' | 'delivery';
  @Column({ type: 'jsonb', nullable: true }) address!: {
    street: string;
    number: string;
    postalCode: string;
    neighborhoodId: number;
    neighborhoodName: string;
  } | null;
  @Column({ type: 'jsonb', nullable: true }) payment!: OrderPayment | null;
  @Column({ type: 'jsonb' }) items!: OrderLineSnapshot[];
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: { to: (v: number) => v, from: (v: string) => Number(v) },
  })
  subtotal!: number;
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: { to: (v: number) => v, from: (v: string) => Number(v) },
  })
  deliveryFee!: number;
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: { to: (v: number) => v, from: (v: string) => Number(v) },
  })
  total!: number;
  @Column({ default: 'received' }) status!: string;
  @CreateDateColumn() createdAt!: Date;
  @UpdateDateColumn() updatedAt!: Date;
}
