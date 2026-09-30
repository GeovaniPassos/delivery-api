import { BadRequestException } from '@nestjs/common';
import { Order } from '../orders/entities/order.entity';

export function manualTransfer(
  data: {
    name: string;
    items: unknown[];
    customer: Record<string, unknown>;
    pendingItem?: unknown;
  },
  target: 'ready' | 'out_for_delivery',
): Partial<Order> {
  if (!data.items.length || data.pendingItem)
    throw new BadRequestException(
      'Salve os itens em preenchimento antes de transferir.',
    );
  const items = data.items.map((raw) => {
    const item = raw as {
      name: string;
      quantity: number;
      unitPrice: number;
      details: string[];
    };
    if (
      !item ||
      typeof item.name !== 'string' ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      !Number.isFinite(item.unitPrice) ||
      item.unitPrice < 0 ||
      !Array.isArray(item.details) ||
      item.details.some((d) => typeof d !== 'string')
    )
      throw new BadRequestException('Revise os itens do pedido.');
    return {
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: Math.round(item.quantity * item.unitPrice * 100) / 100,
      details: item.details,
    };
  });
  const total = Math.round(items.reduce((s, i) => s + i.total, 0) * 100) / 100;
  if (total > 99999999.99)
    throw new BadRequestException('O total excede o limite permitido.');
  const c = data.customer;
  const text = (key: string) =>
    typeof c[key] === 'string' ? (c[key] as string) : '';
  const type =
    (
      { Dinheiro: 'cash', Cartão: 'card', Pix: 'pix' } as Record<
        string,
        'cash' | 'card' | 'pix' | undefined
      >
    )[text('payment')] ?? (text('payment').trim() ? 'other' : null);
  const changeFor =
    typeof c.changeFor === 'number' && Number.isFinite(c.changeFor)
      ? c.changeFor
      : null;
  return {
    source: 'manual',
    customerName: data.name || text('name') || 'Pedido manual',
    phone: text('phone'),
    fulfillment: target === 'ready' ? 'pickup' : 'delivery',
    status: target,
    dispatchedAt: target === 'out_for_delivery' ? new Date() : null,
    address:
      target === 'out_for_delivery'
        ? {
            street: text('street'),
            number: text('number'),
            neighborhoodName: text('neighborhood'),
            neighborhoodId: 0,
            postalCode: '',
            complement: text('complement'),
          }
        : null,
    payment: type
      ? {
          id: 0,
          type,
          name: type === 'other' ? text('payment').trim() : null,
          description: '',
          pixKey: null,
          holderName: null,
          needsChange: !!c.needsChange,
          changeFor,
          change:
            c.needsChange && changeFor !== null
              ? Math.max(0, Math.round((changeFor - total) * 100) / 100)
              : null,
        }
      : null,
    items,
    subtotal: total,
    total,
    deliveryFee: 0,
    trackingToken: null,
    estimatedMinutes: null,
  };
}
