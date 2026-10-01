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
  @Column({ type: 'varchar', default: 'online' }) source!: 'manual' | 'online';
  @Column({ type: 'uuid', unique: true }) requestId!: string;
  @Column({ length: 64 }) requestHash!: string;
  @Column({ type: 'varchar', length: 64, nullable: true, unique: true })
  trackingToken!: string | null;
  @Column({ length: 500 }) customerName!: string;
  @Column({ type: 'text' }) phone!: string;
  @Column({ type: 'varchar', length: 10 }) fulfillment!: 'pickup' | 'delivery';
  @Column({ type: 'jsonb', nullable: true }) address!: {
    street: string;
    number: string;
    postalCode: string;
    neighborhoodId: number;
    neighborhoodName: string;
    complement?: string;
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
  @Column({ type: 'int', nullable: true }) estimatedMinutes!: number | null;
  @Column({ type: 'timestamptz', nullable: true }) dispatchedAt!: Date | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt!: Date;
}
