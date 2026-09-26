import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Category } from '../../categories/entities/category.entity';
export interface PizzaPrice {
  sizeId: string;
  price: number;
  promotionalPrice: number | null;
}
@Entity('pizzas')
export class Pizza {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ length: 120 }) name!: string;
  @Column({ type: 'text', default: '' }) description!: string;
  @Column({ type: 'text', nullable: true }) photo!: string | null;
  @Column() categoryId!: number;
  @ManyToOne(() => Category, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'categoryId' })
  category!: Category;
  @Column({ type: 'jsonb' }) prices!: PizzaPrice[];
  @Column({ type: 'int', array: true, default: () => 'ARRAY[0,1,2,3,4,5,6]' })
  availableDays!: number[];
  @Column({ default: true }) available!: boolean;
}
