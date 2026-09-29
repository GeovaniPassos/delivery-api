import { OptionalGroup } from '../optionals/entities/optional-group.entity';
import {
  ConflictException,
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager, In, QueryFailedError } from 'typeorm';
import { PizzaCategoryCombination } from './entities/pizza-category-combination.entity';
import { combinationIds } from './pizza-combinations';
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
          'Não é possível excluir uma categoria com produtos, pizzas ou opcionais vinculados.',
        );
    }
    throw error;
  }
  async create(dto: CreateCategoryDto) {
    try {
      return await this.categoryTransaction(async (manager) => {
        const repo = manager.getRepository(Category);
        const category = repo.create({
          name: dto.name,
          active: true,
          availableDays: dto.availableDays ?? [...ALL_DAYS],
          isPizza: dto.isPizza ?? false,
          icon: dto.isPizza ? 'pizza' : (dto.icon ?? 'meal'),
          maxFlavors: dto.maxFlavors ?? null,
          pricingRule: dto.pricingRule ?? null,
        });
        configurePizzaCategory(category, dto.pizzaSizes ?? []);
        const saved = await repo.save(category);
        saved.compatibleCategoryIds = await this.syncCombinations(
          manager,
          saved,
          dto.compatibleCategoryIds ?? [],
        );
        return saved;
      });
    } catch (error) {
      this.conflict(error);
    }
  }
  async update(id: number, dto: UpdateCategoryDto) {
    try {
      return await this.categoryTransaction(async (manager) => {
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
        category.icon = category.isPizza ? 'pizza' : (category.icon ?? 'meal');
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
        const groups = await manager
          .getRepository(OptionalGroup)
          .findBy({ categoryId: id });
        if (groups.length && category.isPizza !== previous.isPizza)
          throw new ConflictException(
            'Remova os vínculos dos opcionais antes de alterar o tipo da categoria.',
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
        if (
          groups.some((group) =>
            group.items.some((item) =>
              item.sizePrices.some((price) => !validIds.has(price.sizeId)),
            ),
          )
        )
          throw new ConflictException(
            'Não é possível remover um tamanho com bordas cadastradas. Edite os opcionais primeiro.',
          );
        const current = await this.links(manager, id);
        category.compatibleCategoryIds = await this.syncCombinations(
          manager,
          category,
          dto.compatibleCategoryIds ?? combinationIds(id, current),
        );
        return repo.save(category);
      });
    } catch (error) {
      this.conflict(error);
    }
  }
  async findAll() {
    const categories = await this.repository.find({ order: { id: 'ASC' } });
    const links = await this.dataSource
      .getRepository(PizzaCategoryCombination)
      .find();
    return categories.map((category) => ({
      ...category,
      compatibleCategoryIds: combinationIds(category.id, links),
    }));
  }
  async findOne(id: number) {
    const category = await this.repository.findOneBy({ id });
    if (!category) throw new NotFoundException('Categoria não encontrada.');
    return {
      ...category,
      compatibleCategoryIds: combinationIds(
        id,
        await this.links(this.dataSource.manager, id),
      ),
    };
  }
  async remove(id: number) {
    try {
      const result = await this.categoryTransaction((manager) =>
        manager.getRepository(Category).delete(id),
      );
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
      category.compatibleCategoryIds = combinationIds(
        id,
        await this.links(manager, id),
      );
      return repo.save(category);
    });
  }
  private categoryTransaction<T>(work: (manager: EntityManager) => Promise<T>) {
    return this.dataSource.transaction(async (manager) => {
      // Serialize category configuration changes, including changes to either
      // endpoint of a reciprocal combination, before acquiring row locks.
      await manager.query('SELECT pg_advisory_xact_lock(709312)');
      return work(manager);
    });
  }
  private links(manager: EntityManager, id: number) {
    return manager
      .getRepository(PizzaCategoryCombination)
      .find({ where: [{ categoryId: id }, { compatibleCategoryId: id }] });
  }
  private async syncCombinations(
    manager: EntityManager,
    category: Category,
    requested: number[],
  ) {
    const ids =
      category.isPizza && (category.maxFlavors ?? 1) > 1
        ? [...new Set(requested)].sort((a, b) => a - b)
        : [];
    if (ids.includes(category.id))
      throw new BadRequestException(
        'Não selecione a própria categoria no conjunto.',
      );
    if (ids.length) {
      const targets = await manager
        .getRepository(Category)
        .findBy({ id: In(ids) });
      if (
        targets.length !== ids.length ||
        targets.some((c) => !c.isPizza || (c.maxFlavors ?? 1) < 2)
      )
        throw new BadRequestException(
          'Combine apenas categorias de pizza que aceitam mais de um sabor.',
        );
    }
    const repo = manager.getRepository(PizzaCategoryCombination);
    await repo.delete([
      { categoryId: category.id },
      { compatibleCategoryId: category.id },
    ]);
    if (ids.length)
      await repo.save(
        ids.map((id) =>
          repo.create({
            categoryId: Math.min(category.id, id),
            compatibleCategoryId: Math.max(category.id, id),
          }),
        ),
      );
    return ids;
  }
}
