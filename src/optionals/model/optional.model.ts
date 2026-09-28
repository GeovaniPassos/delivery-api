export type OptionalKind = 'general' | 'pizza-extra' | 'pizza-crust';
export type OptionalScope = 'category' | 'products';
export interface OptionalItem {
  id: string;
  name: string;
  price: number | null;
  sizePrices: { sizeId: string; price: number }[];
}
