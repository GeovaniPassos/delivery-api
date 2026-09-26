import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { Category } from '../categories/entities/category.entity';
import { Pizza } from './entities/pizza.entity';
import { CreatePizzaDto } from './dto/create-pizza.dto';
import { UpdatePizzaDto } from './dto/update-pizza.dto';
import { validatePizza } from './pizza-rules';
@Injectable()
export class PizzasService {
  constructor(private readonly dataSource: DataSource) {}
  findAll() {
    return this.dataSource
      .getRepository(Pizza)
      .find({ relations: { category: true }, order: { id: 'ASC' } });
  }
  async findOne(id: number) {
    const pizza = await this.dataSource
      .getRepository(Pizza)
      .findOne({ where: { id }, relations: { category: true } });
    if (!pizza) throw new NotFoundException('Sabor de pizza não encontrado.');
    return pizza;
  }
  create(dto: CreatePizzaDto) {
    return this.save(null, dto);
  }
  update(id: number, dto: UpdatePizzaDto) {
    return this.save(id, dto);
  }
  private save(id: number | null, dto: CreatePizzaDto | UpdatePizzaDto) {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Pizza);
      const previous =
        id === null
          ? null
          : await repo.findOne({
              where: { id },
              lock: { mode: 'pessimistic_write' },
            });
      if (id !== null && !previous)
        throw new NotFoundException('Sabor de pizza não encontrado.');
      const pizza = repo.create({
        description: '',
        photo: null,
        available: true,
        ...previous,
        ...dto,
        prices: (dto.prices ?? previous?.prices ?? []).map((price) => ({
          ...price,
          promotionalPrice: price.promotionalPrice ?? null,
        })),
      });
      const category = await manager
        .getRepository(Category)
        .findOne({
          where: { id: pizza.categoryId },
          lock: { mode: 'pessimistic_write' },
        });
      validatePizza(pizza, category);
      return repo.save(pizza);
    });
  }
  async availability(ids: number[], available: boolean) {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Pizza);
      const pizzas = await repo.find({
        where: { id: In(ids) },
        order: { id: 'ASC' },
        lock: { mode: 'pessimistic_write' },
      });
      if (pizzas.length !== ids.length)
        throw new NotFoundException(
          'Um ou mais sabores não foram encontrados. Recarregue a lista.',
        );
      await repo.update({ id: In(ids) }, { available });
      return { ids, available };
    });
  }
  async remove(ids: number[]) {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Pizza);
      const pizzas = await repo.find({
        where: { id: In(ids) },
        order: { id: 'ASC' },
        lock: { mode: 'pessimistic_write' },
      });
      if (pizzas.length !== ids.length)
        throw new NotFoundException(
          'Um ou mais sabores não foram encontrados. Recarregue a lista.',
        );
      await repo.delete({ id: In(ids) });
      return { ids };
    });
  }
}
