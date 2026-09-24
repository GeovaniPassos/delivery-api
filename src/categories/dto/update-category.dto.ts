import { PartialType } from '@nestjs/mapped-types';
import { CreateCategoryDto } from './create-category.dto';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Length } from 'class-validator';

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {
    @Transform(({ value }) => 
            typeof value === 'string' ? value.trim() : value,
        )
        @IsString({
            message: 'O nome da categoria deve ser um texto',
        })
        @IsNotEmpty({
            message: 'O nome da categoria é obrigatório',
        })
        @Length(2, 60, {
            message: 'O nome deve possuir entre 2 e 60 caracteres',
        })
    name!: string;
}
