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
  /** The discount Apple really applies — its nearest price point, not the one requested. */
  user_discount_pct: number;
  /** What the buyer actually pays at that price point. Null when the code changes no price. */
  apple_customer_price: number | null;
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

// ─── Redemptions, balances and payouts ────────────────────────────────────────

export interface DashboardTotals {
  redemptions: number;
  reversed: number;
  grossAttributed: number;
  netAttributed: number;
  commissionAccrued: number;
  commissionUnpaid: number;
  overLimit: number;
}

export interface ResellerBalance {
  id: string;
  name: string;
  tier: ResellerTier;
  is_active: boolean;
  redemptions: number;
  gross: number;
  commission: number;
  unpaid: number;
  codes: number;
}

export interface RecentRedemption {
  id: string;
  created_at: string;
  status: 'accrued' | 'reversed';
  over_limit: boolean;
  applies_to: string;
  gross_amount: number;
  net_amount: number;
  commission_amount: number;
  currency_code: string;
  storyteller_id: string | null;
  store_transaction_id: string | null;
  code: string | null;
  reseller: string | null;
}

export interface Payout {
  id: string;
  created_at: string;
  status: 'draft' | 'approved' | 'paid' | 'void';
  currency_code: string;
  commission_due: number;
  redemption_count: number;
  paid_at: string | null;
  reference: string | null;
  reseller: string | null;
}

export interface PromoDashboard {
  totals: DashboardTotals;
  byReseller: ResellerBalance[];
  recent: RecentRedemption[];
  payouts: Payout[];
  storeCutPct: number;
}

export function fetchPromoDashboard(): Promise<PromoDashboard> {
  return adminFetch('/admin/promos/dashboard');
}

export function createPayout(resellerId: string, currency = 'CAD'): Promise<{
  status: string;
  payout_id: string;
  commission_due: number;
  redemption_count: number;
}> {
  return adminFetch('/admin/payouts', {
    method: 'POST',
    body: JSON.stringify({ resellerId, currency }),
  });
}

export function markPayoutPaid(payoutId: string, reference?: string): Promise<Payout> {
  return adminFetch(`/admin/payouts/${payoutId}/paid`, {
    method: 'POST',
    body: JSON.stringify({ reference }),
  });
}
