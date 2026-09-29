import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
@Entity('neighborhoods')
export class Neighborhood {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ length: 120, unique: true }) name!: string;
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: { to: (v: number) => v, from: (v: string) => Number(v) },
  })
  fee!: number;
  @Column({ default: true }) active!: boolean;
}
