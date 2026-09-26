import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Category } from './entities/category.entity';
import { PizzaPricingRule } from './model/pizza-settings';
import { PizzaSizeDto } from './dto/create-category.dto';
export function configurePizzaCategory(
  category: Category,
  sizes: PizzaSizeDto[],
  previous?: Category,
): void {
  if (!category.isPizza) {
    category.pizzaSizes = [];
    category.maxFlavors = null;
    category.pricingRule = null;
    return;
  }
  if (!sizes?.length)
    throw new BadRequestException(
      'Informe ao menos um tamanho para a categoria de pizza.',
    );
  if (
    !Number.isInteger(category.maxFlavors) ||
    category.maxFlavors! < 1 ||
    category.maxFlavors! > 20
  )
    throw new BadRequestException('Informe um limite de 1 a 20 sabores.');
  if (!Object.values(PizzaPricingRule).includes(category.pricingRule!))
    throw new BadRequestException(
      'Escolha a cobrança pelo maior valor ou pela média.',
    );
  const names = sizes.map((s) => s.name.trim().toLocaleLowerCase('pt-BR'));
  if (new Set(names).size !== names.length)
    throw new BadRequestException('Os tamanhos devem ter nomes diferentes.');
  const ids = sizes.filter((s) => s.id).map((s) => s.id);
  if (new Set(ids).size !== ids.length)
    throw new BadRequestException(
      'Os identificadores dos tamanhos não podem se repetir.',
    );
  if (ids.some((id) => !previous?.pizzaSizes.some((size) => size.id === id)))
    throw new BadRequestException('Tamanho não pertence a esta categoria.');
  category.pizzaSizes = sizes.map((size) => ({
    id: size.id ?? randomUUID(),
    name: size.name.trim(),
  }));
}
