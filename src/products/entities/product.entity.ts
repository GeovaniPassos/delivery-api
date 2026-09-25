import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Category } from '../../categories/entities/category.entity';

const money = {
  to: (value: number | null) => value,
  from: (value: string | null) => (value === null ? null : Number(value)),
};

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ length: 120 }) name!: string;
  @Column({ type: 'text', default: '' }) description!: string;
  @Column({ type: 'text', nullable: true }) photo!: string | null;
  @Column({ type: 'decimal', precision: 10, scale: 2, transformer: money })
  price!: number;
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: money,
  })
  promotionalPrice!: number | null;
  @Column() categoryId!: number;
  @ManyToOne(() => Category, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'categoryId' })
  category!: Category;
  @Column({ default: true }) available!: boolean;
}
