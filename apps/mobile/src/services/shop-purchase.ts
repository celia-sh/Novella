import type { ShopItem } from '@novella/api-client';

export type ShopPurchaseState =
  | 'available'
  | 'limitReached'
  | 'unavailable'
  | 'unlimited';

export interface ShopPurchaseAvailability {
  remaining: number | null;
  state: ShopPurchaseState;
}

export function resolveShopPurchaseAvailability(
  item: Pick<ShopItem, 'monthlyLimit' | 'monthlyPurchased'>,
): ShopPurchaseAvailability {
  if (item.monthlyLimit === null) {
    return { remaining: null, state: 'unlimited' };
  }

  const remaining = Math.max(0, item.monthlyLimit - item.monthlyPurchased);
  if (item.monthlyLimit === 0) {
    return { remaining, state: 'unavailable' };
  }
  return {
    remaining,
    state: remaining === 0 ? 'limitReached' : 'available',
  };
}
