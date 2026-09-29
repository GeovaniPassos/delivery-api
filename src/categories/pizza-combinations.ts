import { PizzaCategoryCombination } from './entities/pizza-category-combination.entity';
export function combinationIds(
  id: number,
  links: Pick<
    PizzaCategoryCombination,
    'categoryId' | 'compatibleCategoryId'
  >[],
): number[] {
  return links
    .flatMap((link) =>
      link.categoryId === id
        ? [link.compatibleCategoryId]
        : link.compatibleCategoryId === id
          ? [link.categoryId]
          : [],
    )
    .sort((a, b) => a - b);
}
export function normalizedSizeName(name: string): string {
  return name.trim().normalize('NFC').toLocaleLowerCase('pt-BR');
}
