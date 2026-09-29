export const categoryIcons = [
  'pizza',
  'sandwich',
  'meal',
  'juice',
  'drink',
  'snack',
  'soda',
] as const;
export type CategoryIcon = (typeof categoryIcons)[number];
