import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
describe('CategoriesController', () => {
  it('forwards category settings without discarding them', () => {
    const create = jest.fn();
    const controller = new CategoriesController({
      create,
    } as unknown as CategoriesService);
    const dto = {
      name: 'Pizzas',
      isPizza: true,
      availableDays: [5, 6],
      pizzaSizes: [{ name: 'Gigante do dia' }],
      maxFlavors: 2,
    };
    controller.create(dto);
    expect(create).toHaveBeenCalledWith(dto);
  });
});
