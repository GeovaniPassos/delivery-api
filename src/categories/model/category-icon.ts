export const categoryIcons = [
  'pizza',
  'sandwich',
  'meal',
  'juice',
  'drink',
  'snack',
  'soda',
  'sweets',
  'misc',
] as const;
export type CategoryIcon = (typeof categoryIcons)[number];
