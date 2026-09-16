import { IsOptional, IsString } from "class-validator";

export class CreateCategoryDto {
    constructor(id: number, name: string) {
        this.name = name;
    }

    @IsString()
    name: string;

    @IsOptional()
    active?: boolean;
}