import { calculateOrder, OrderCatalog } from './order-pricing';
import { QuoteOrderDto } from './dto/create-order.dto';
import { Category } from '../categories/entities/category.entity';
import { Product } from '../products/entities/product.entity';
import { Pizza } from '../pizzas/entities/pizza.entity';
import { OptionalGroup } from '../optionals/entities/optional-group.entity';

const date = new Date('2026-09-29T01:00:00Z'); // Monday in Sao Paulo.
const category = {
  id: 1,
  name: 'Lanches',
  active: true,
  isPizza: false,
  availableDays: [1],
} as Category;
const product = {
  id: 1,
  name: 'Lanche',
  categoryId: 1,
  category,
  available: true,
  availableDays: [1],
  ingredients: ['Queijo'],
  price: 20,
  promotionalPrice: 18,
} as Product;
const group = {
  id: 1,
  name: 'Extras',
  kind: 'general',
  scope: 'category',
  categoryId: 1,
  products: [],
  quantitative: true,
  maxTotal: 0,
  maxPerOption: 0,
  items: [{ id: 'cheese', name: 'Queijo extra', price: 2.5, sizePrices: [] }],
} as OptionalGroup;
function catalog(): OrderCatalog {
  return {
    products: [structuredClone(product)],
    pizzas: [],
    categories: [structuredClone(category)],
    groups: [structuredClone(group)],
    neighborhood: { id: 1, name: 'Centro', fee: 5, active: true },
  };
}
function request(): QuoteOrderDto {
  return {
    fulfillment: 'delivery',
    neighborhoodId: 1,
    items: [
      {
        type: 'product',
        productId: 1,
        quantity: 2,
        removedIngredients: ['Queijo'],
        optionals: [{ groupId: 1, itemId: 'cheese', quantity: 2 }],
      },
    ],
  };
}
describe('Order pricing', () => {
  it('uses current promotional prices, optional units, line quantity and delivery fee', () => {
    const result = calculateOrder(request(), catalog(), date);
    expect(result).toMatchObject({ subtotal: 46, deliveryFee: 5, total: 51 });
    expect(result.items[0].details).toContain('Sem Queijo');
  });
  it('pickup ignores delivery fee', () => {
    expect(
      calculateOrder({ ...request(), fulfillment: 'pickup' }, catalog(), date)
        .total,
    ).toBe(46);
  });
  it('zero limits allow multiple units but finite and nonquantitative limits apply', () => {
    const c = catalog();
    c.groups[0].maxPerOption = 1;
    expect(() => calculateOrder(request(), c, date)).toThrow(
      'Limite por opção',
    );
    c.groups[0].maxPerOption = 0;
    c.groups[0].maxTotal = 1;
    expect(() => calculateOrder(request(), c, date)).toThrow('Limite total');
    c.groups[0].maxTotal = 0;
    c.groups[0].quantitative = false;
    expect(() => calculateOrder(request(), c, date)).toThrow(
      'Limite por opção',
    );
  });
  it('rejects unavailable weekdays, removals, foreign optionals and disabled neighborhoods', () => {
    const c = catalog();
    c.products[0].availableDays = [2];
    expect(() => calculateOrder(request(), c, date)).toThrow(
      'não está disponível',
    );
    c.products[0].availableDays = [1];
    c.products[0].ingredients = [];
    expect(() => calculateOrder(request(), c, date)).toThrow('ingrediente');
    c.products[0].ingredients = ['Queijo'];
    c.groups[0].categoryId = 2;
    expect(() => calculateOrder(request(), c, date)).toThrow(
      'Opcional não permitido',
    );
    c.groups[0].categoryId = 1;
    c.neighborhood!.active = false;
    expect(() => calculateOrder(request(), c, date)).toThrow('bairro atendido');
  });
  it('prices pizza flavors by average or highest and border by selected size', () => {
    const c = catalog();
    const cat = {
      ...category,
      isPizza: true,
      pizzaSizes: [{ id: 'large', name: 'Grande' }],
      maxFlavors: 2,
      pricingRule: 'average',
    } as Category;
    c.categories = [cat];
    c.pizzas = [35, 55].map(
      (price, i) =>
        ({
          ...product,
          id: i + 1,
          category: cat,
          name: 'Sabor ' + i,
          prices: [{ sizeId: 'large', price: 60, promotionalPrice: price }],
        }) as unknown as Pizza,
    );
    c.groups = [
      {
        ...group,
        kind: 'pizza-crust',
        maxPerOption: 1,
        items: [
          {
            id: 'border',
            name: 'Borda',
            price: null,
            sizePrices: [
              { sizeId: 'large', price: 8 },
              { sizeId: 'small', price: 5 },
            ],
          },
        ],
      },
    ];
    const req: QuoteOrderDto = {
      fulfillment: 'pickup',
      items: [
        {
          type: 'pizza',
          categoryId: 1,
          sizeId: 'large',
          quantity: 2,
          removedIngredients: [],
          flavors: [
            { pizzaId: 1, removedIngredients: [] },
            { pizzaId: 2, removedIngredients: ['Queijo'] },
          ],
          optionals: [{ groupId: 1, itemId: 'border', quantity: 1 }],
        },
      ],
    };
    expect(calculateOrder(req, c, date).total).toBe(106);
    cat.pricingRule = 'highest';
    expect(calculateOrder(req, c, date).total).toBe(126);
    cat.maxFlavors = 1;
    expect(() => calculateOrder(req, c, date)).toThrow('Quantidade de sabores');
  });
});
