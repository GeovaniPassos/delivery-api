export enum PizzaPricingRule {
  HIGHEST = 'highest',
  AVERAGE = 'average',
}
export interface PizzaSize {
  id: string;
  name: string;
  maxFlavors?: number;
}
export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
