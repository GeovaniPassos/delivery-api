export const orderStatuses = [
  'received',
  'accepted',
  'preparing',
  'ready',
  'out_for_delivery',
  'completed',
] as const;
export type OrderStatus = (typeof orderStatuses)[number];
export const orderGroups = {
  placed: ['received', 'accepted'],
  preparing: ['preparing'],
  waiting: ['ready', 'out_for_delivery'],
  completed: ['completed'],
} as const;
export function nextOrderStatus(
  status: string,
  fulfillment: 'pickup' | 'delivery',
): OrderStatus | null {
  switch (status) {
    case 'received':
      return 'accepted';
    case 'accepted':
      return 'preparing';
    case 'preparing':
      return fulfillment === 'pickup' ? 'ready' : 'out_for_delivery';
    case 'ready':
      return fulfillment === 'pickup' ? 'completed' : null;
    case 'out_for_delivery':
      return fulfillment === 'delivery' ? 'completed' : null;
    default:
      return null;
  }
}
