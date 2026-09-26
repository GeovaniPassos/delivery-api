import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, QueryFailedError } from 'typeorm';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Category } from './entities/category.entity';
import { Product } from '../products/entities/product.entity';
import { Pizza } from '../pizzas/entities/pizza.entity';
import { configurePizzaCategory } from './category-rules';
import { ALL_DAYS } from './model/pizza-settings';
@Injectable()
export class CategoriesService {
  constructor(private readonly dataSource: DataSource) {}
  private get repository() {
    return this.dataSource.getRepository(Category);
  }
  private conflict(error: unknown): never {
    if (error instanceof QueryFailedError) {
      const code = (error.driverError as { code?: string }).code;
      if (code === '23505')
        throw new ConflictException('Já existe uma categoria com esse nome.');
      if (code === '23503')
        throw new ConflictException(
          'Não é possível excluir uma categoria com produtos ou pizzas vinculados.',
        );
    }
    throw error;
  }
  async create(dto: CreateCategoryDto) {
    const category = this.repository.create({
      name: dto.name,
      active: true,
      availableDays: dto.availableDays ?? [...ALL_DAYS],
      isPizza: dto.isPizza ?? false,
      maxFlavors: dto.maxFlavors ?? null,
      pricingRule: dto.pricingRule ?? null,
    });
    configurePizzaCategory(category, dto.pizzaSizes ?? []);
    try {
      return await this.repository.save(category);
    } catch (error) {
      this.conflict(error);
    }
  }
  async update(id: number, dto: UpdateCategoryDto) {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const repo = manager.getRepository(Category);
        const previous = await repo.findOne({
          where: { id },
          lock: { mode: 'pessimistic_write' },
        });
        if (!previous) throw new NotFoundException('Categoria não encontrada.');
        const category = repo.create({
          ...previous,
          ...dto,
          pizzaSizes: previous.pizzaSizes,
        });
        configurePizzaCategory(
          category,
          dto.pizzaSizes ?? previous.pizzaSizes,
          previous,
        );
        if (
          !previous.isPizza &&
          category.isPizza &&
          (await manager.getRepository(Product).countBy({ categoryId: id }))
        )
          throw new ConflictException(
            'Esta categoria possui produtos. Mova-os para outra categoria antes de transformá-la em categoria de pizza.',
          );
        const pizzas = await manager
          .getRepository(Pizza)
          .findBy({ categoryId: id });
        if (pizzas.length && !category.isPizza)
          throw new ConflictException(
            'Esta categoria possui pizzas. Mova ou exclua os sabores antes de alterar o tipo.',
          );
        const validIds = new Set(category.pizzaSizes.map((size) => size.id));
        if (
          pizzas.some((pizza) =>
            pizza.prices.some((price) => !validIds.has(price.sizeId)),
          )
        )
          throw new ConflictException(
            'Não é possível remover um tamanho com preços cadastrados. Você pode renomeá-lo.',
          );
        return repo.save(category);
      });
    } catch (error) {
      this.conflict(error);
    }
  }
  findAll() {
    return this.repository.find({ order: { id: 'ASC' } });
  }
  async findOne(id: number) {
    const category = await this.repository.findOneBy({ id });
    if (!category) throw new NotFoundException('Categoria não encontrada.');
    return category;
  }
  async remove(id: number) {
    try {
      const result = await this.repository.delete(id);
      if (!result.affected)
        throw new NotFoundException('Categoria não encontrada.');
    } catch (error) {
      this.conflict(error);
    }
  }
  async updateStatus(id: number) {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Category);
      const category = await repo.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!category) throw new NotFoundException('Categoria não encontrada.');
      category.active = !category.active;
      return repo.save(category);
    });
  }
}
