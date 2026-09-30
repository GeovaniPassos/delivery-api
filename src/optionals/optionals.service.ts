import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { Category } from '../categories/entities/category.entity';
import { Product } from '../products/entities/product.entity';
import { OptionalGroup } from './entities/optional-group.entity';
import { CreateOptionalGroupDto } from './dto/create-optional-group.dto';
import { validateOptionalGroup } from './optional-rules';
@Injectable()
export class OptionalsService {
  constructor(private readonly dataSource: DataSource) {}
  private response(group: OptionalGroup) {
    return { ...group, productIds: group.products.map((p) => p.id) };
  }
  async findAll() {
    return (
      await this.dataSource.getRepository(OptionalGroup).find({
        relations: { category: true, products: true },
        order: { id: 'ASC' },
      })
    ).map((g) => this.response(g));
  }
  create(dto: CreateOptionalGroupDto) {
    return this.save(null, dto);
  }
  update(id: number, dto: CreateOptionalGroupDto) {
    return this.save(id, dto);
  }
  private save(id: number | null, dto: CreateOptionalGroupDto) {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(OptionalGroup);
      const previous =
        id === null
          ? null
          : await repo.findOne({
              where: { id },
              lock: { mode: 'pessimistic_write' },
            });
      if (id !== null && !previous)
        throw new NotFoundException('Grupo de opcionais não encontrado.');
      const category =
        dto.categoryId === null
          ? null
          : await manager.getRepository(Category).findOne({
              where: { id: dto.categoryId },
              lock: { mode: 'pessimistic_write' },
            });
      const products = dto.productIds.length
        ? await manager.getRepository(Product).find({
            where: { id: In(dto.productIds) },
            relations: { category: true },
          })
        : [];
      const categoryIds = dto.categoryIds ?? [];
      if (categoryIds.length) {
        const linked = await manager
          .getRepository(Category)
          .find({ where: { id: In(categoryIds) } });
        if (
          dto.kind !== 'pizza-crust' ||
          linked.length !== categoryIds.length ||
          linked.some((c) => !c.isPizza)
        )
          throw new BadRequestException(
            'Selecione apenas categorias de pizza para as bordas.',
          );
      }
      const items = validateOptionalGroup(dto, category, products, previous);
      const { productIds, ...fields } = dto;
      const group = repo.create({
        ...previous,
        ...fields,
        categoryIds,
        items,
        category,
        products,
      });
      return this.response(await repo.save(group));
    });
  }
  async remove(id: number) {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(OptionalGroup);
      const group = await repo.findOne({
        where: { id },
        relations: { products: true },
      });
      if (!group)
        throw new NotFoundException('Grupo de opcionais não encontrado.');
      await repo.remove(group);
    });
  }
}
