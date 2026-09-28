import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Category } from '../categories/entities/category.entity';
import { Product } from '../products/entities/product.entity';
import { CreateOptionalGroupDto } from './dto/create-optional-group.dto';
import { OptionalGroup } from './entities/optional-group.entity';
export function validateOptionalGroup(
  dto: CreateOptionalGroupDto,
  category: Category | null,
  products: Product[],
  previous?: OptionalGroup | null,
) {
  const fail = (message: string): never => {
    throw new BadRequestException(message);
  };
  if (dto.scope === 'category') {
    if (!category || dto.productIds.length)
      fail('Selecione uma categoria e remova os produtos selecionados.');
    if (category!.isPizza !== (dto.kind !== 'general'))
      fail('Selecione uma categoria compatível com o tipo de opcional.');
  } else {
    if (
      dto.kind !== 'general' ||
      dto.categoryId !== null ||
      !dto.productIds.length
    )
      fail('Selecione os produtos para os opcionais gerais.');
    if (
      products.length !== dto.productIds.length ||
      products.some((p) => p.category.isPizza)
    )
      fail(
        'Um ou mais produtos não existem ou pertencem a uma categoria de pizza.',
      );
  }
  if (dto.maxTotal > 0 && dto.maxPerOption > dto.maxTotal)
    fail('O limite por opção não pode ultrapassar o limite total.');
  if (!dto.quantitative && dto.maxPerOption !== 1)
    fail('Opcionais não quantitativos permitem apenas uma unidade por opção.');
  if (
    dto.kind === 'pizza-crust' &&
    (dto.quantitative || dto.maxTotal !== 1 || dto.maxPerOption !== 1)
  )
    fail('Escolha apenas uma borda por pizza.');
  const names = new Set<string>();
  const ids = new Set<string>();
  return dto.items.map((item) => {
    const key = item.name.toLocaleLowerCase('pt-BR');
    if (names.has(key)) fail('Não repita nomes de itens no mesmo grupo.');
    names.add(key);
    if (
      item.id &&
      (!previous?.items.some((i) => i.id === item.id) || ids.has(item.id))
    )
      fail('Identificador de item inválido ou repetido.');
    const id = item.id ?? randomUUID();
    ids.add(id);
    if (dto.kind === 'pizza-crust') {
      const valid = new Set(category!.pizzaSizes.map((s) => s.id));
      if (
        item.price !== null ||
        !item.sizePrices.length ||
        item.sizePrices.some((p) => !valid.has(p.sizeId))
      )
        fail(
          'Informe os valores da borda apenas para tamanhos da categoria selecionada.',
        );
    } else if (item.price === null || item.sizePrices.length)
      fail('Informe um preço único para cada adicional.');
    return { ...item, id };
  });
}
