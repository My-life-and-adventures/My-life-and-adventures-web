import { apiFetch } from './client';
import { getAdminToken } from '../features/admin/supabase';

/**
 * Admin dashboard API.
 *
 * Authenticates with the Supabase JWT of the signed-in admin, not the viewer
 * session token `apiFetch` reaches for by default. The backend checks that
 * token's email against its ADMIN_EMAILS allowlist on every request, so nothing
 * here is trusted to gate itself.
 */

export type ResellerTier = 'free' | 'a' | 'b';

export interface Reseller {
  id: string;
  name: string;
  email: string | null;
  tier: ResellerTier;
  payout_method: string | null;
  is_active: boolean;
  created_at: string;
}

export interface PromoEarnings {
  gross: number;
  net: number;
  commission: number;
  unpaid: number;
}

export interface Promo {
  id: string;
  name: string;
  code: string;
  reseller_id: string;
  commission_pct: number;
  user_discount_pct: number;
  apple_offer_id: string | null;
  is_free: boolean;
  max_redemptions: number | null;
  redeemed_count: number;
  valid_until: string | null;
  is_active: boolean;
  created_at: string;
  resellers: { name: string; tier: ResellerTier } | null;
  earnings: PromoEarnings;
}

export interface PricePoint {
  id: string;
  customerPrice: number;
  discountPct: number;
}

export interface PricePointPreview {
  plan: { name: string; label: string; listPrice: number; currency: string };
  requestedDiscountPct: number;
  nearest: PricePoint;
  options: PricePoint[];
}

export interface CreatedPromo {
  promotionId: string;
  code: string;
  tier: ResellerTier;
  appleOfferId: string | null;
  effectiveDiscountPct: number | null;
  customerPrice: number | null;
}

async function adminFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getAdminToken();
  if (!token) {
    throw new Error('Not signed in');
  }
  return apiFetch<T>(path, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${token}` },
  });
}

/** Confirms the signed-in account is on the allowlist before rendering anything. */
export function fetchAdminMe(): Promise<{ id: string; email: string; isAdmin: true }> {
  return adminFetch('/admin/me');
}

export function fetchResellers(): Promise<Reseller[]> {
  return adminFetch('/admin/resellers');
}

export function createReseller(body: {
  name: string;
  email?: string;
  tier: ResellerTier;
  payoutMethod?: string;
  notes?: string;
}): Promise<Reseller> {
  return adminFetch('/admin/resellers', { method: 'POST', body: JSON.stringify(body) });
}

export function fetchPromos(includeInactive = false): Promise<Promo[]> {
  return adminFetch(`/admin/promos?includeInactive=${includeInactive}`);
}

/** Read-only: what discounts Apple can actually apply, before committing. */
export function fetchPricePoints(
  planName: string,
  targetDiscountPct: number,
): Promise<PricePointPreview> {
  return adminFetch(
    `/admin/promos/price-points?planName=${planName}&targetDiscountPct=${targetDiscountPct}`,
  );
}

export function createPromo(body: {
  resellerId: string;
  code: string;
  name: string;
  units: number;
  planName: string;
  commissionPct: number;
  userDiscountPct: number;
  expiresAt: string;
}): Promise<CreatedPromo> {
  return adminFetch('/admin/promos', { method: 'POST', body: JSON.stringify(body) });
}
