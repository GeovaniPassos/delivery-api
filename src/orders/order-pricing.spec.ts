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

function mixedPizza() {
  const c = catalog();
  const savory = {
    ...category,
    isPizza: true,
    maxFlavors: 2,
    pricingRule: 'average',
    pizzaSizes: [{ id: 'large', name: 'Grande' }],
    compatibleCategoryIds: [2],
  } as Category;
  const sweet = {
    ...savory,
    id: 2,
    name: 'Doces',
    maxFlavors: 4,
    pricingRule: 'highest',
    pizzaSizes: [{ id: 'sweet-large', name: ' grande ' }],
    compatibleCategoryIds: [1],
  } as Category;
  c.categories = [savory];
  c.pizzas = [savory, sweet].map(
    (cat, i) =>
      ({
        ...product,
        id: i + 1,
        name: ['Salgada', 'Doce'][i],
        categoryId: cat.id,
        category: cat,
        prices: [
          {
            sizeId: cat.pizzaSizes[0].id,
            price: 80,
            promotionalPrice: i ? 55 : 35,
          },
        ],
      }) as unknown as Pizza,
  );
  c.groups = [
    { ...group, kind: 'pizza-extra' },
    { ...group, id: 2, kind: 'pizza-extra', categoryId: 2 },
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
        optionals: [],
        observation: '  Cortar bem  ',
        flavors: [
          {
            pizzaId: 1,
            removedIngredients: ['Queijo'],
            optionals: [{ groupId: 1, itemId: 'cheese', quantity: 2 }],
          },
          {
            pizzaId: 2,
            removedIngredients: [],
            optionals: [{ groupId: 2, itemId: 'cheese', quantity: 1 }],
          },
        ],
      },
    ],
  };
  return { c, req };
}
describe('Mixed pizza configuration', () => {
  it('matches size names across IDs, applies root pricing and charges full extras for each flavor', () => {
    const { c, req } = mixedPizza();
    const result = calculateOrder(req, c, date);
    expect(result.total).toBe(105); // (average 45 + 5 + 2.50) * 2
    expect(result.items[0].details).toEqual(
      expect.arrayContaining([
        'Sem Queijo (Salgada)',
        '+ 2 × Queijo extra (Extras) — Salgada',
        '+ 1 × Queijo extra (Extras) — Doce',
        'Observação: Cortar bem',
      ]),
    );
    c.categories[0].pricingRule = 'highest' as Category['pricingRule'];
    expect(calculateOrder(req, c, date).total).toBe(125);
    req.items[0].flavors!.push({ ...req.items[0].flavors![0], pizzaId: 3 });
    expect(() => calculateOrder(req, c, date)).toThrow('Quantidade de sabores');
  });
  it('rejects unauthorized categories, single-flavor substitutions and mismatched sizes', () => {
    const { c, req } = mixedPizza();
    c.categories[0].compatibleCategoryIds = [];
    expect(() => calculateOrder(req, c, date)).toThrow(
      'Sabor de pizza inválido',
    );
    c.categories[0].compatibleCategoryIds = [2];
    c.pizzas[1].category.pizzaSizes[0].name = 'Pequena';
    expect(() => calculateOrder(req, c, date)).toThrow('tamanho equivalente');
    c.pizzas[1].category.pizzaSizes[0].name = 'Grande';
    c.pizzas[1].category.active = false;
    expect(() => calculateOrder(req, c, date)).toThrow('não está disponível');
    c.pizzas[1].category.active = true;
    c.pizzas[1].availableDays = [2];
    expect(() => calculateOrder(req, c, date)).toThrow('não está disponível');
    c.pizzas[1].availableDays = [1];
    req.items[0].flavors!.shift();
    expect(() => calculateOrder(req, c, date)).toThrow(
      'Sabor de pizza inválido',
    );
  });
  it('restricts extras to their flavor category, rejects borders inside flavors and shares limits', () => {
    const { c, req } = mixedPizza();
    req.items[0].flavors![1].optionals![0].groupId = 1;
    expect(() => calculateOrder(req, c, date)).toThrow(
      'Opcional não permitido',
    );
    c.pizzas[1].category = c.pizzas[0].category;
    c.pizzas[1].categoryId = 1;
    c.pizzas[1].prices[0].sizeId = 'large';
    c.groups[0].maxPerOption = 2;
    expect(() => calculateOrder(req, c, date)).toThrow('Limite por opção');
    c.groups[0].maxPerOption = 0;
    c.groups[0].maxTotal = 2;
    expect(() => calculateOrder(req, c, date)).toThrow('Limite total');
    c.groups[0].maxTotal = 0;
    expect(calculateOrder(req, c, date).total).toBe(105);
    c.groups[0].kind = 'pizza-crust';
    expect(() => calculateOrder(req, c, date)).toThrow(
      'Opcional não permitido',
    );
  });
});
