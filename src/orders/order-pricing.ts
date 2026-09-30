import { BadRequestException } from '@nestjs/common';
import { Product } from '../products/entities/product.entity';
import { Pizza } from '../pizzas/entities/pizza.entity';
import { Category } from '../categories/entities/category.entity';
import { OptionalGroup } from '../optionals/entities/optional-group.entity';
import { Neighborhood } from '../neighborhoods/entities/neighborhood.entity';
import { QuoteOrderDto } from './dto/create-order.dto';
import { OrderQuote } from './model/order.model';
import { normalizedSizeName } from '../categories/pizza-combinations';
export interface OrderCatalog {
  products: Product[];
  pizzas: Pizza[];
  categories: Category[];
  groups: OptionalGroup[];
  neighborhood: Neighborhood | null;
}
const fail = (message: string): never => {
  throw new BadRequestException(message);
};
export function cents(value: number) {
  const result = Math.round(value * 100);
  if (!Number.isSafeInteger(result) || result < 0 || result > 9999999999)
    fail('O valor do pedido ultrapassa o limite permitido.');
  return result;
}
export function calculateOrder(
  dto: QuoteOrderDto,
  catalog: OrderCatalog,
  date = new Date(),
): OrderQuote {
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      weekday: 'short',
    }).format(date),
  );
  const validDays = (days: number[]) => days.includes(weekday);
  const available = (item: Product | Pizza) => {
    if (
      !item.available ||
      !item.category?.active ||
      !validDays(item.availableDays) ||
      !validDays(item.category.availableDays)
    )
      fail(item.name + ' não está disponível agora.');
  };
  const removals = (item: Product | Pizza, names: string[]) => {
    if (names.some((n) => !item.ingredients.includes(n)))
      fail(
        'Um ingrediente de ' + item.name + ' foi alterado. Revise o carrinho.',
      );
    return names.map((n) => 'Sem ' + n);
  };
  const items = dto.items.map((line) => {
    let categoryId: number;
    let base: number;
    let name: string;
    let details: string[] = [];
    if (line.type === 'product') {
      const product = catalog.products.find((p) => p.id === line.productId);
      if (!product) fail('Um produto não existe mais. Revise o carrinho.');
      available(product!);
      if (product!.category.isPizza) fail('Tipo de produto inválido.');
      categoryId = product!.categoryId;
      base = cents(product!.promotionalPrice ?? product!.price);
      name = product!.name;
      details = removals(product!, line.removedIngredients);
    } else {
      const category = catalog.categories.find((c) => c.id === line.categoryId);
      if (
        !category?.isPizza ||
        !category.active ||
        !validDays(category.availableDays)
      )
        fail('Categoria de pizza indisponível.');
      const size = category!.pizzaSizes.find((s) => s.id === line.sizeId);
      if (!size) fail('Tamanho de pizza indisponível.');
      if (
        !line.flavors?.length ||
        line.flavors.length > (category!.maxFlavors ?? 0)
      )
        fail('Quantidade de sabores inválida.');
      if (line.removedIngredients.length)
        fail('Selecione os ingredientes por sabor.');
      categoryId = category!.id;
      name = 'Pizza ' + size!.name;
      const prices = line.flavors!.map((flavor) => {
        const pizza = catalog.pizzas.find((p) => p.id === flavor.pizzaId);
        const compatible =
          pizza &&
          (pizza.categoryId === categoryId ||
            (line.flavors!.length > 1 &&
              category!.compatibleCategoryIds?.includes(pizza.categoryId) &&
              pizza.category.isPizza &&
              (pizza.category.maxFlavors ?? 1) > 1));
        if (!compatible) fail('Sabor de pizza inválido para esta categoria.');
        available(pizza!);
        const flavorSize =
          pizza!.categoryId === categoryId
            ? size
            : pizza!.category.pizzaSizes.find(
                (s) =>
                  normalizedSizeName(s.name) === normalizedSizeName(size!.name),
              );
        if (!flavorSize)
          fail('Um sabor não possui tamanho equivalente ao selecionado.');
        const price = pizza!.prices.find((p) => p.sizeId === flavorSize!.id);
        if (!price) fail('Um sabor não tem preço para este tamanho.');
        details.push(
          pizza!.name,
          ...removals(pizza!, flavor.removedIngredients).map(
            (r) => r + ' (' + pizza!.name + ')',
          ),
        );
        return cents(price!.promotionalPrice ?? price!.price);
      });
      base =
        category!.pricingRule === 'highest'
          ? Math.max(...prices)
          : Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
    }
    let extras = 0;
    let crustCount = 0;
    const totals = new Map<number, number>();
    const itemTotals = new Map<string, number>();
    const choices = [
      ...line.optionals.map((selected) => ({
        selected,
        pizza: undefined as Pizza | undefined,
      })),
      ...(line.type === 'pizza'
        ? line.flavors!.flatMap((flavor) =>
            (flavor.optionals ?? []).map((selected) => ({
              selected,
              pizza: catalog.pizzas.find((p) => p.id === flavor.pizzaId),
            })),
          )
        : []),
    ];
    for (const { selected, pizza: flavorPizza } of choices) {
      const group = catalog.groups.find((g) => g.id === selected.groupId);
      if (!group)
        fail('Um grupo de opcionais foi removido. Revise o carrinho.');
      const root = catalog.categories.find((c) => c.id === categoryId);
      const crustCategory =
        group!.category ??
        catalog.categories.find((c) => c.id === group!.categoryId);
      const sharedCrust =
        group!.kind === 'pizza-crust' &&
        (group!.categoryId === categoryId ||
          group!.categoryIds?.includes(categoryId) ||
          (group!.categoryId != null &&
            root?.compatibleCategoryIds?.includes(group!.categoryId)));
      const applicable =
        line.type === 'product'
          ? group!.kind === 'general' &&
            (group!.scope === 'category'
              ? group!.categoryId === categoryId
              : group!.products.some((p) => p.id === line.productId))
          : flavorPizza
            ? group!.kind === 'pizza-extra' &&
              group!.scope === 'category' &&
              group!.categoryId === flavorPizza.categoryId
            : group!.kind !== 'general' &&
              group!.scope === 'category' &&
              (group!.categoryId === categoryId || sharedCrust);
      if (!applicable) fail('Opcional não permitido para este produto.');
      const item = group!.items.find((i) => i.id === selected.itemId);
      if (!item) fail('Um opcional não existe mais.');
      const limit = group!.quantitative ? group!.maxPerOption : 1;
      const itemKey = group!.id + ':' + selected.itemId;
      const itemTotal = (itemTotals.get(itemKey) ?? 0) + selected.quantity;
      if (
        !Number.isSafeInteger(itemTotal) ||
        (limit !== 0 && itemTotal > limit)
      )
        fail('Limite por opção excedido em ' + group!.name + '.');
      itemTotals.set(itemKey, itemTotal);
      const total = (totals.get(group!.id) ?? 0) + selected.quantity;
      if (
        !Number.isSafeInteger(total) ||
        (group!.maxTotal > 0 && total > group!.maxTotal)
      )
        fail('Limite total excedido em ' + group!.name + '.');
      totals.set(group!.id, total);
      const selectedSize = root?.pizzaSizes?.find((s) => s.id === line.sizeId);
      const crustSizeId =
        group!.categoryId === categoryId
          ? line.sizeId
          : crustCategory?.pizzaSizes?.find(
              (s) =>
                selectedSize &&
                normalizedSizeName(s.name) ===
                  normalizedSizeName(selectedSize.name),
            )?.id;
      const price =
        group!.kind === 'pizza-crust'
          ? item!.sizePrices.find((p) => p.sizeId === crustSizeId)?.price
          : item!.price;
      if (price == null) fail('Opcional sem preço para este tamanho.');
      if (group!.kind === 'pizza-crust') crustCount += selected.quantity;
      if (crustCount > 1) fail('Escolha apenas uma borda por pizza.');
      extras += cents(price!) * selected.quantity;
      details.push(
        '+ ' +
          selected.quantity +
          ' × ' +
          item!.name +
          ' (' +
          group!.name +
          ')' +
          (flavorPizza ? ' — ' + flavorPizza.name : ''),
      );
    }
    const unitPrice = cents((base + extras) / 100) / 100;
    const total = cents(unitPrice * line.quantity) / 100;
    if (line.observation?.trim())
      details.push('Observação: ' + line.observation.trim());
    return { name, quantity: line.quantity, unitPrice, total, details };
  });
  const neighborhood =
    dto.fulfillment === 'delivery' ? catalog.neighborhood : null;
  if (
    dto.fulfillment === 'delivery' &&
    (!neighborhood?.active || neighborhood.id !== dto.neighborhoodId)
  )
    fail('Selecione um bairro atendido.');
  const subtotal =
    cents(items.reduce((sum, item) => sum + item.total, 0)) / 100;
  const deliveryFee = neighborhood ? cents(neighborhood.fee) / 100 : 0;
  const total = cents(subtotal + deliveryFee) / 100;
  return {
    items,
    subtotal,
    deliveryFee,
    total,
    neighborhood: neighborhood
      ? { id: neighborhood.id, name: neighborhood.name }
      : null,
  };
}
