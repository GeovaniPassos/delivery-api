import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Category } from './entities/category.entity';
import { Repository } from 'typeorm';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoriesRepository: Repository<Category>
  ) {}

  async create(createCategoryDto: CreateCategoryDto): Promise<Category> {
    const existingCategory = 
      await this.categoriesRepository.findOneBy({
      name: createCategoryDto.name,
    });

    if (existingCategory) {
      throw new ConflictException('A categoria já existe.');
    }

    const category = this.categoriesRepository.create({
      name: createCategoryDto.name,
    });

    return this.categoriesRepository.save(category);
  }

  async update(id: number, updateCategoryDto: UpdateCategoryDto): Promise<Category> {

    const category = await this.categoriesRepository.preload({
      id,
      ...updateCategoryDto
    });

    if (!category) {
      throw new NotFoundException(`Usuário com id ${id} não encontrado`);
    }

    return this.categoriesRepository.save(category);
      
  }

  findAll() {
    return this.categoriesRepository.find();
  }

  findOne(id: number) {
    return this.categoriesRepository.findOneBy({ id });
  }

  remove(id: number) {
    return this.categoriesRepository.delete(id);
  }

  async updateStatus(id: string) {
    const category = await this.findOne(Number(id));

    if (!category) {
      throw new NotFoundException('Categoria não encontrada!');
    }

    category.active = !category.active;

    return this.categoriesRepository.save(category);

  }
}
