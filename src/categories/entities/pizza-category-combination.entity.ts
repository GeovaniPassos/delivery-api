import { Check, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Category } from './category.entity';
@Entity('pizza_category_combinations')
@Check('pizza_category_pair_order', '"categoryId" < "compatibleCategoryId"')
export class PizzaCategoryCombination {
  @PrimaryColumn({ type: 'int' }) categoryId!: number;
  @PrimaryColumn({ type: 'int' }) compatibleCategoryId!: number;
  @ManyToOne(() => Category, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'categoryId' })
  category!: Category;
  @ManyToOne(() => Category, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'compatibleCategoryId' })
  compatibleCategory!: Category;
}
