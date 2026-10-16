import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('customers')
export class Customer {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'varchar', length: 120 }) name!: string;
  @Column({ type: 'varchar', length: 120, unique: true, nullable: true }) phone!: string | null;
  @Column({ type: 'jsonb', nullable: true }) address!: {
    street?: string; number?: string; postalCode?: string; neighborhoodId?: number;
    neighborhoodName?: string; complement?: string; deliveryFee?: number;
  } | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt!: Date;
}
