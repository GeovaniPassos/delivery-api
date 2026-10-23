import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export interface ComboOptional {
  name: string;
  price: number;
}

@Entity('combos')
export class Combo {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ length: 120 }) name!: string;
  @Column({ type: 'text', default: '' }) description!: string;
  @Column({ type: 'decimal', precision: 10, scale: 2, transformer: { to: (v: number) => v, from: (v: string) => Number(v) } }) price!: number;
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" }) categoryIds!: number[];
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" }) productIds!: number[];
  @Column({ default: false }) allowHalfAndHalf!: boolean;
  @Column({ type: 'int', default: 1 }) maxPizzaFlavors!: number;
  @Column({ default: false }) optionalsEnabled!: boolean;
  @Column({ type: 'varchar', length: 20, default: 'category' }) optionalSource!: 'category' | 'custom';
  @Column({ default: false }) optionalsRequired!: boolean;
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" }) customOptionals!: { name: string; price: number }[];
  @Column({ default: true }) active!: boolean;
}
