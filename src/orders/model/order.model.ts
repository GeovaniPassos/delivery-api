export interface OrderLineSnapshot {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
  details: string[];
}
export interface OrderQuote {
  items: OrderLineSnapshot[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  neighborhood: { id: number; name: string } | null;
}
export interface OrderPayment {
  id: number;
  type: 'cash' | 'card' | 'pix';
  pixKey: string | null;
  holderName: string | null;
  description: string;
  needsChange: boolean;
  changeFor: number | null;
  change: number | null;
}
