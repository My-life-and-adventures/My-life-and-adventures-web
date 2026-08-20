import { useEffect, useState, type FormEvent } from 'react';
import {
  createPromo,
  createReseller,
  fetchPricePoints,
  fetchPromos,
  fetchResellers,
  type CreatedPromo,
  type PricePointPreview,
  type Promo,
  type Reseller,
  type ResellerTier,
} from '../../api/admin';

/**
 * Reseller promo codes.
 *
 * Three tiers, all issued as blocks of codes:
 *   free — 0% commission, 0% discount, the code makes the app free
 *   A    — 15% commission, buyer pays full price
 *   B    — 10% commission, buyer pays an Apple-discounted price
 *
 * Only tier B touches Apple. Its discount cannot be applied by us — the backend
 * creates a real App Store offer code over the App Store Connect API, which is
 * why the form previews Apple's actual price points before submitting.
 */

const TIERS: { value: ResellerTier; label: string; commission: number; discount: number }[] = [
  { value: 'free', label: 'Free / testers', commission: 0, discount: 0 },
  { value: 'a', label: 'Reseller A', commission: 15, discount: 0 },
  { value: 'b', label: 'Reseller B', commission: 10, discount: 5 },
];

const PLANS = ['base', 'advance', 'premium'];

export function Promos() {
  const [resellers, setResellers] = useState<Reseller[] | null>(null);
  const [promos, setPromos] = useState<Promo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchResellers(), fetchPromos(true)])
      .then(([r, p]) => {
        if (cancelled) return;
        setResellers(r);
        setPromos(p);
        setError(null);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const reload = () => setReloadKey((k) => k + 1);

  return (
    <div className="admin-stack">
      {error ? <p className="viewer-error">{error}</p> : null}

      <NewResellerForm onCreated={reload} />
      <NewPromoForm resellers={resellers ?? []} onCreated={reload} />

      <section className="admin-panel">
        <h2>Codes</h2>
        {promos == null ? (
          <p className="admin-muted">Loading…</p>
        ) : promos.length === 0 ? (
          <p className="admin-muted">No codes yet.</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Reseller</th>
                <th className="admin-num">Used</th>
                <th className="admin-num">Commission</th>
                <th className="admin-num">Discount</th>
                <th className="admin-num">Owed</th>
                <th>Expires</th>
              </tr>
            </thead>
            <tbody>
              {promos.map((p) => (
                <tr key={p.id} className={p.is_active ? undefined : 'admin-row-off'}>
                  <td>
                    <span className="admin-code">{p.code}</span>
                    {p.apple_offer_id ? (
                      <span className="admin-badge" title={`Apple offer ${p.apple_offer_id}`}>
                        App Store
                      </span>
                    ) : null}
                  </td>
                  <td>
                    {p.resellers?.name ?? '—'}
                    <span className="admin-tier">{tierLabel(p.resellers?.tier)}</span>
                  </td>
                  <td className="admin-num">
                    {p.redeemed_count}
                    {p.max_redemptions ? ` / ${p.max_redemptions}` : ''}
                  </td>
                  <td className="admin-num">{p.commission_pct}%</td>
                  <td className="admin-num">
                    {p.is_free ? 'free' : p.user_discount_pct > 0 ? `${p.user_discount_pct}%` : '—'}
                  </td>
                  <td className="admin-num">{money(p.earnings.unpaid)}</td>
                  <td className="admin-nowrap">
                    {p.valid_until ? new Date(p.valid_until).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function NewResellerForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [tier, setTier] = useState<ResellerTier>('a');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createReseller({ name: name.trim(), email: email.trim() || undefined, tier });
      setName('');
      setEmail('');
      onCreated();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin-panel">
      <h2>Add a reseller</h2>
      {error ? <p className="viewer-error">{error}</p> : null}
      <form className="admin-form" onSubmit={submit}>
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Tier
          <select value={tier} onChange={(e) => setTier(e.target.value as ResellerTier)}>
            {TIERS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label} — {t.commission}% / {t.discount}%
              </option>
            ))}
          </select>
        </label>
        <div className="admin-form-actions">
          <button type="submit" disabled={busy || !name.trim()}>
            {busy ? 'Saving…' : 'Add reseller'}
          </button>
        </div>
      </form>
    </section>
  );
}

function NewPromoForm({
  resellers,
  onCreated,
}: {
  resellers: Reseller[];
  onCreated: () => void;
}) {
  const [resellerId, setResellerId] = useState('');
  const [code, setCode] = useState('');
  const [units, setUnits] = useState(50);
  const [planName, setPlanName] = useState('base');
  const [expiresAt, setExpiresAt] = useState(defaultExpiry());
  const [preview, setPreview] = useState<PricePointPreview | null>(null);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedPromo | null>(null);

  const reseller = resellers.find((r) => r.id === resellerId);
  const terms = TIERS.find((t) => t.value === reseller?.tier);
  const discountPct = terms?.discount ?? 0;
  const commissionPct = terms?.commission ?? 0;

  /**
   * Only a discounting tier needs Apple. Checking first is the whole reason the
   * form has two steps: the offer is not something you want to create twice.
   */
  async function check() {
    setChecking(true);
    setError(null);
    try {
      setPreview(await fetchPricePoints(planName, discountPct));
    } catch (err) {
      setError((err as Error).message);
      setPreview(null);
    } finally {
      setChecking(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!reseller) return;
    setBusy(true);
    setError(null);
    try {
      const result = await createPromo({
        resellerId,
        code: code.trim().toUpperCase(),
        name: `${reseller.name} ${code.trim().toUpperCase()}`,
        units,
        planName,
        commissionPct,
        userDiscountPct: discountPct,
        expiresAt: new Date(expiresAt).toISOString(),
      });
      setCreated(result);
      setCode('');
      setPreview(null);
      onCreated();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin-panel">
      <h2>Create a code</h2>
      <p className="admin-muted admin-panel-note">
        Terms come from the reseller&apos;s tier. Tier B creates a real App Store offer code —
        check the price first, because the offer cannot be undone from here.
      </p>

      {error ? <p className="viewer-error">{error}</p> : null}
      {created ? (
        <p className="viewer-notice">
          Created <strong>{created.code}</strong>
          {created.appleOfferId
            ? ` — App Store offer ${created.appleOfferId}, customers pay ${money(
                created.customerPrice ?? 0,
              )} (${created.effectiveDiscountPct}% off)`
            : ' — no App Store offer needed for this tier'}
        </p>
      ) : null}

      <form className="admin-form" onSubmit={submit}>
        <label>
          Reseller
          <select
            value={resellerId}
            onChange={(e) => {
              setResellerId(e.target.value);
              setPreview(null);
            }}
            required
          >
            <option value="">Choose…</option>
            {resellers.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({tierLabel(r.tier)})
              </option>
            ))}
          </select>
        </label>
        <label>
          Code
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase())}
            placeholder="SPRING50"
            minLength={4}
            maxLength={24}
            required
          />
        </label>
        <label>
          Units
          <input
            type="number"
            min={1}
            value={units}
            onChange={(e) => setUnits(Number(e.target.value))}
            required
          />
        </label>
        <label>
          Plan
          <select
            value={planName}
            onChange={(e) => {
              setPlanName(e.target.value);
              setPreview(null);
            }}
          >
            {PLANS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label>
          Expires
          <input
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            required
          />
        </label>

        {reseller ? (
          <p className="admin-terms">
            {commissionPct}% commission to {reseller.name}
            {discountPct > 0 ? `, ${discountPct}% discount to the buyer` : ', buyer pays full price'}
            {reseller.tier === 'free' ? ' — this code makes the app free' : ''}
          </p>
        ) : null}

        {preview ? (
          <div className="admin-preview">
            <p>
              Nearest App Store price point to {discountPct}%:{' '}
              <strong>
                {money(preview.nearest.customerPrice)} ({preview.nearest.discountPct.toFixed(1)}%
                off {money(preview.plan.listPrice)})
              </strong>
            </p>
            <p className="admin-muted">
              Apple sells at fixed price points, so this is the real discount customers will get.
            </p>
          </div>
        ) : null}

        <div className="admin-form-actions">
          {discountPct > 0 ? (
            <button
              type="button"
              className="admin-btn-quiet"
              disabled={checking || !reseller}
              onClick={() => void check()}
            >
              {checking ? 'Checking Apple…' : 'Check price'}
            </button>
          ) : null}
          <button
            type="submit"
            // A discounting code must be previewed first: creating the App Store
            // offer is the irreversible half of this form.
            disabled={busy || !reseller || code.trim().length < 4 || (discountPct > 0 && !preview)}
          >
            {busy ? 'Creating…' : 'Create code'}
          </button>
        </div>
      </form>
    </section>
  );
}

function tierLabel(tier?: ResellerTier | null): string {
  return TIERS.find((t) => t.value === tier)?.label ?? '—';
}

function money(n: number): string {
  return n.toLocaleString(undefined, { style: 'currency', currency: 'CAD' });
}

/** Apple requires custom codes to expire; a year out is a sane default. */
function defaultExpiry(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}
