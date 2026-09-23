import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('categories')
export class Category {
 
    @PrimaryGeneratedColumn()
    id!: number; 

    @Column({
        type: 'varchar',
        length: 60,
        unique: true,
    })
    name!: string;

    @Column({ 
        type: 'boolean', 
        default: true, 
    })
    active!: boolean;
}