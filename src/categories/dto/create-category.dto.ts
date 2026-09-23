import { Transform } from "class-transformer";
import { IsNotEmpty, IsOptional, IsString, Length } from "class-validator";

export class CreateCategoryDto {
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