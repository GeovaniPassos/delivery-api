import { BadRequestException } from '@nestjs/common';
import { Category } from '../categories/entities/category.entity';
import { Pizza } from './entities/pizza.entity';
export function validatePizza(pizza: Pizza, category: Category | null): void {
  if (!category?.isPizza)
    throw new BadRequestException('Selecione uma categoria de pizza.');
  const sizeIds = new Set(category.pizzaSizes.map((s) => s.id));
  const priceIds = new Set(pizza.prices.map((p) => p.sizeId));
  if (
    pizza.prices.length !== sizeIds.size ||
    priceIds.size !== sizeIds.size ||
    pizza.prices.some((p) => !sizeIds.has(p.sizeId))
  )
    throw new BadRequestException(
      'Informe um preço para cada tamanho da categoria, sem repetições.',
    );
  if (
    pizza.prices.some(
      (p) => p.promotionalPrice != null && p.promotionalPrice >= p.price,
    )
  )
    throw new BadRequestException(
      'O valor promocional deve ser menor que o valor normal em cada tamanho.',
    );
  pizza.category = category;
}
