import {
  Check,
  Column,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
@Entity('store_settings')
@Check('store_settings_singleton', '"id" = 1')
export class StoreSettings {
  @PrimaryColumn({ type: 'int' }) id!: number;
  @Column({ default: true }) isOpen!: boolean;
  @Column({ type: 'int', nullable: true }) deliveryMinutes!: number | null;
  @Column({ type: 'int', nullable: true }) pickupMinutes!: number | null;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt!: Date;
}
