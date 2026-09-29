import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';
import { PizzaPricingRule } from '../model/pizza-settings';
import type { PizzaSize } from '../model/pizza-settings';
import type { CategoryIcon } from '../model/category-icon';
@Entity('categories')
export class Category {
  // Populated from reciprocal combination pairs, not persisted as an array.
  compatibleCategoryIds?: number[];
  @PrimaryGeneratedColumn() id!: number;
  @Column({ length: 60, unique: true }) name!: string;
  @Column({ default: true }) active!: boolean;
  @Column({ type: 'int', array: true, default: () => 'ARRAY[0,1,2,3,4,5,6]' })
  availableDays!: number[];
  @Column({ default: false }) isPizza!: boolean;
  @Column({ type: 'varchar', length: 12, default: 'meal' }) icon!: CategoryIcon;
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  pizzaSizes!: PizzaSize[];
  @Column({ type: 'int', nullable: true }) maxFlavors!: number | null;
  @Column({ type: 'varchar', length: 10, nullable: true })
  pricingRule!: PizzaPricingRule | null;
}
