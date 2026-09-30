import { calculateOrder, OrderCatalog } from './order-pricing';
import { QuoteOrderDto } from './dto/create-order.dto';
import { Category } from '../categories/entities/category.entity';
import { Pizza } from '../pizzas/entities/pizza.entity';
import { OptionalGroup } from '../optionals/entities/optional-group.entity';

describe('Shared crust pricing', () => {
  function setup() {
    const root = {
      id: 1,
      isPizza: true,
      active: true,
      availableDays: [1],
      maxFlavors: 2,
      pricingRule: 'highest',
      pizzaSizes: [{ id: 'g', name: 'Grande' }],
      compatibleCategoryIds: [2],
    } as Category;
    const sweet = {
      ...root,
      id: 2,
      pizzaSizes: [{ id: 'sweet-g', name: 'Grande' }],
      compatibleCategoryIds: [1],
    } as Category;
    const pizza = {
      id: 1,
      name: 'Queijo',
      categoryId: 1,
      category: root,
      available: true,
      availableDays: [1],
      ingredients: [],
      prices: [{ sizeId: 'g', price: 40, promotionalPrice: null }],
    } as Pizza;
    const group = {
      id: 2,
      kind: 'pizza-crust',
      scope: 'category',
      categoryId: 2,
      category: sweet,
      name: 'Bordas doces',
      quantitative: false,
      maxTotal: 1,
      maxPerOption: 1,
      items: [
        {
          id: 'choc',
          name: 'Chocolate',
          price: null,
          sizePrices: [{ sizeId: 'sweet-g', price: 10 }],
        },
      ],
    } as OptionalGroup;
    const catalog: OrderCatalog = {
      categories: [root],
      pizzas: [pizza],
      groups: [group],
      products: [],
      neighborhood: null,
    };
    const dto: QuoteOrderDto = {
      fulfillment: 'pickup',
      items: [
        {
          type: 'pizza',
          categoryId: 1,
          sizeId: 'g',
          quantity: 1,
          removedIngredients: [],
          flavors: [{ pizzaId: 1, removedIngredients: [] }],
          optionals: [{ groupId: 2, itemId: 'choc', quantity: 1 }],
        },
      ],
    };
    return { catalog, dto, root, sweet, group };
  }
  const date = new Date('2026-09-28T15:00:00Z');
  it('uses the crust category equivalent-size price', () => {
    const { catalog, dto } = setup();
    expect(calculateOrder(dto, catalog, date).total).toBe(50);
  });
  it('requires compatibility or explicit category assignment', () => {
    const { catalog, dto, root, group } = setup();
    root.compatibleCategoryIds = [];
    expect(() => calculateOrder(dto, catalog, date)).toThrow(
      'Opcional não permitido',
    );
    group.categoryIds = [1];
    expect(calculateOrder(dto, catalog, date).total).toBe(50);
  });
  it('rejects a crust lacking the matching size and still rejects multiple crusts', () => {
    const { catalog, dto, sweet, group } = setup();
    sweet.pizzaSizes[0].name = 'Pequena';
    expect(() => calculateOrder(dto, catalog, date)).toThrow('sem preço');
    sweet.pizzaSizes[0].name = 'Grande';
    catalog.groups.push({ ...group, id: 3 });
    dto.items[0].optionals.push({ groupId: 3, itemId: 'choc', quantity: 1 });
    expect(() => calculateOrder(dto, catalog, date)).toThrow(
      'apenas uma borda',
    );
  });
});
