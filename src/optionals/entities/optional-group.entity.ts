import {
  Column,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Category } from '../../categories/entities/category.entity';
import { Product } from '../../products/entities/product.entity';
import type {
  OptionalItem,
  OptionalKind,
  OptionalScope,
} from '../model/optional.model';
@Entity('optional_groups')
export class OptionalGroup {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ length: 120 }) name!: string;
  @Column({ type: 'varchar', length: 20 }) kind!: OptionalKind;
  @Column({ type: 'varchar', length: 20 }) scope!: OptionalScope;
  @Column({ type: 'int', nullable: true }) categoryId!: number | null;
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  categoryIds!: number[];
  @ManyToOne(() => Category, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'categoryId' })
  category!: Category | null;
  @ManyToMany(() => Product, { onDelete: 'RESTRICT' })
  @JoinTable({ name: 'optional_group_products' })
  products!: Product[];
  @Column({ default: false }) quantitative!: boolean;
  @Column({ type: 'int', default: 1 }) maxTotal!: number;
  @Column({ type: 'int', default: 1 }) maxPerOption!: number;
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  items!: OptionalItem[];
}
