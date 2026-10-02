import { BadRequestException } from '@nestjs/common';
import { configurePizzaCategory } from './category-rules';
import { Category } from './entities/category.entity';
import { PizzaPricingRule } from './model/pizza-settings';
describe('Category pizza rules', () => {
  const create = () =>
    Object.assign(new Category(), {
      isPizza: true,
      maxFlavors: 2,
      pricingRule: PizzaPricingRule.AVERAGE,
      pizzaSizes: [],
    });
  it('assigns stable size IDs and preserves them on rename', () => {
    const category = create();
    configurePizzaCategory(category, [{ name: 'Grande' }]);
    const id = category.pizzaSizes[0].id;
    const updated = create();
    configurePizzaCategory(updated, [{ id, name: 'Gigante do dia' }], category);
    expect(updated.pizzaSizes).toEqual([{ id, name: 'Gigante do dia' }]);
  });
  it('rejects missing sizes, duplicate names and foreign identifiers', () => {
    expect(() => configurePizzaCategory(create(), [])).toThrow(
      BadRequestException,
    );
    expect(() =>
      configurePizzaCategory(create(), [
        { name: 'Grande' },
        { name: ' grande ' },
      ]),
    ).toThrow(BadRequestException);
    expect(() =>
      configurePizzaCategory(create(), [{ id: 'external', name: 'Grande' }]),
    ).toThrow(BadRequestException);
  });
  it('requires valid limit and pricing rule and clears irrelevant settings', () => {
    const category = create();
    category.maxFlavors = 0;
    expect(() =>
      configurePizzaCategory(category, [{ name: 'Grande' }]),
    ).toThrow();
    category.maxFlavors = 2;
    category.pricingRule = null;
    expect(() =>
      configurePizzaCategory(category, [{ name: 'Grande' }]),
    ).toThrow();
    category.isPizza = false;
    configurePizzaCategory(category, []);
    expect(category).toMatchObject({
      pizzaSizes: [],
      maxFlavors: null,
      pricingRule: null,
    });
  });
  it('persists limits by size and derives the category maximum', () => {
    const category = create();
    configurePizzaCategory(category, [
      { name: 'Pequena', maxFlavors: 1 },
      { name: 'Grande', maxFlavors: 4 },
    ]);
    expect(category.maxFlavors).toBe(4);
    expect(category.pizzaSizes.map((s) => s.maxFlavors)).toEqual([1, 4]);
    for (const maxFlavors of [0, 21, 1.5]) {
      expect(() =>
        configurePizzaCategory(create(), [{ name: 'Grande', maxFlavors }]),
      ).toThrow();
    }
  });
});
