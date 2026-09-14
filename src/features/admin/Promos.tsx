import { useEffect, useState, type FormEvent } from 'react';
import { useToast } from '../../components/toast-context';
import {
  createPromo,
  createReseller,
  deletePromo,
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
 *   free — 0% commission, a free App Store offer: the plan free for a year,
 *          then the regular price
 *   A    — 15% commission, buyer pays full price
 *   B    — 10% commission, buyer pays an Apple-discounted price
 *
 * Free and B touch Apple. Neither can be applied by us — the backend
 * creates a real App Store offer code over the App Store Connect API, which is
 * why the form previews Apple's actual price points before submitting.
 */

const TIERS: { value: ResellerTier; label: string; commission: number; discount: number }[] = [
  // A free App Store offer: the plan at no charge for a year, then the regular price.
  { value: 'free', label: 'Free (App Store offer)', commission: 0, discount: 100 },
  { value: 'a', label: 'Reseller A', commission: 15, discount: 0 },
  { value: 'b', label: 'Reseller B', commission: 10, discount: 5 },
];

const PLANS = ['base', 'advance', 'premium'];

export function Promos({ onChanged }: { onChanged?: () => void } = {}) {
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

  const reload = () => {
    setReloadKey((k) => k + 1);
    onChanged?.();
  };

  const toast = useToast();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  /**
   * Deletes a code after saying plainly what that will do. A used code is
   * switched off rather than deleted — its redemptions are the commission
   * ledger — and the toast reports which of the two the server did.
   */
  async function remove(p: Promo) {
    const used = p.redeemed_count > 0;
    const lines = [
      `Delete ${p.code}?`,
      p.apple_offer_id
        ? 'Its App Store offer will be switched off too (Apple does not allow deleting offers).'
        : null,
      used
        ? `It has been used ${p.redeemed_count} ${p.redeemed_count === 1 ? 'time' : 'times'}, so it will be switched off instead of deleted, and its commission history kept.`
        : 'This cannot be undone.',
    ].filter(Boolean);
    if (!window.confirm(lines.join('\n\n'))) return;

    setDeletingId(p.id);
    try {
      const result = await deletePromo(p.id);
      if (result.status === 'deleted') {
        toast.success(`${result.code} deleted`, 'It can no longer be redeemed.');
      } else {
        toast.info(
          `${result.code} switched off`,
          `It has ${result.redemptions} ${result.redemptions === 1 ? 'redemption' : 'redemptions'}, so it was kept for its commission history. It can no longer be redeemed.`,
        );
      }
      reload();
    } catch (err) {
      toast.error(`Could not delete ${p.code}`, (err as Error).message);
    } finally {
      setDeletingId(null);
    }
  }

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
                <th />
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
                  {/* The discount is Apple's effective one, so the price beside
                      it is what a buyer is actually charged — the two together
                      are what the reseller's flyer can honestly claim. */}
                  <td className="admin-num">
                    {p.is_free ? (
                      'free'
                    ) : p.user_discount_pct > 0 ? (
                      <>
                        {Number(p.user_discount_pct).toFixed(1)}%
                        {p.apple_customer_price != null ? (
                          <span className="admin-tier">{money(p.apple_customer_price)}</span>
                        ) : null}
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="admin-num">{money(p.earnings.unpaid)}</td>
                  <td className="admin-nowrap">
                    {p.valid_until ? new Date(p.valid_until).toLocaleDateString() : '—'}
                  </td>
                  <td className="admin-nowrap">
                    {/* A used code that is already off has nothing left to remove:
                        it is kept on purpose, for its commission history. */}
                    {p.is_active || p.redeemed_count === 0 ? (
                      <button
                        type="button"
                        className="admin-btn-danger"
                        disabled={deletingId !== null}
                        onClick={() => void remove(p)}
                      >
                        {deletingId === p.id ? 'Deleting…' : 'Delete'}
                      </button>
                    ) : (
                      <span className="admin-muted">Switched off</span>
                    )}
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
  const toast = useToast();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const terms = TIERS.find((t) => t.value === tier);
    try {
      await createReseller({ name: name.trim(), email: email.trim() || undefined, tier });
      toast.success(
        `${name.trim()} added`,
        terms
          ? `${terms.label} — ${terms.commission}% commission${
              terms.discount > 0 ? `, ${terms.discount}% buyer discount` : ''
            }. Create a code for them below.`
          : undefined,
      );
      setName('');
      setEmail('');
      onCreated();
    } catch (err) {
      toast.error('Could not add reseller', (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin-panel">
      <h2>Add a reseller</h2>
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
  const [confirmedDeviation, setConfirmedDeviation] = useState(false);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<CreatedPromo | null>(null);
  const toast = useToast();

  const reseller = resellers.find((r) => r.id === resellerId);
  const terms = TIERS.find((t) => t.value === reseller?.tier);
  const discountPct = terms?.discount ?? 0;
  const commissionPct = terms?.commission ?? 0;
  // Free codes are Apple offers with no price to check — only Tier B needs one.
  const isFree = reseller?.tier === 'free';

  // How far the real price point sits from what was asked for. Apple's catalog
  // is fine-grained enough that a healthy fetch normally lands within a point
  // or two of the target — a double-digit gap is the signature of something
  // having gone wrong upstream (a stale/partial price-point fetch, the wrong
  // territory, a plan mismatch) rather than "Apple just doesn't sell that".
  const deviationPct = preview ? Math.abs(preview.nearest.discountPct - discountPct) : 0;
  const deviatesFromTarget = preview != null && deviationPct > 10;

  /**
   * Only a discounting tier needs Apple. Checking first is the whole reason the
   * form has two steps: the offer is not something you want to create twice.
   */
  async function check() {
    setChecking(true);
    setConfirmedDeviation(false);
    try {
      const result = await fetchPricePoints(planName, discountPct);
      setPreview(result);
      toast.info(
        `Apple can discount to ${money(result.nearest.customerPrice)}`,
        `That is ${result.nearest.discountPct.toFixed(1)}% off ${money(
          result.plan.listPrice,
        )} — the closest price point Apple offers to ${discountPct}%.`,
      );
    } catch (err) {
      toast.error('Could not reach the App Store', (err as Error).message);
      setPreview(null);
    } finally {
      setChecking(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!reseller) return;
    setBusy(true);
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
      toast.success(
        `${result.code} is live`,
        result.appleOfferId
          ? result.tier === 'free'
            ? `${planName} free for one year through the App Store, then the regular price. Give this code to ${reseller.name}.`
            : `Customers pay ${money(result.customerPrice ?? 0)} (${result.effectiveDiscountPct}% off). Give this code to ${reseller.name}.`
          : `${units} ${units === 1 ? 'unit' : 'units'} on the ${planName} plan, at full price. Give this code to ${reseller.name}.`,
      );
      setCode('');
      setPreview(null);
      onCreated();
    } catch (err) {
      toast.error('Could not create the code', (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin-panel">
      <h2>Create a code</h2>
      <p className="admin-muted admin-panel-note">
        Terms come from the reseller&apos;s tier. Tier B and Free both create a real App Store
        offer code, which cannot be undone from here — for Tier B, check the price first.
      </p>

      {created ? (
        <p className="viewer-notice">
          Created <strong>{created.code}</strong>
          {created.appleOfferId
            ? created.tier === 'free'
              ? ` — App Store offer ${created.appleOfferId}, free for one year, then the regular price`
              : ` — App Store offer ${created.appleOfferId}, customers pay ${money(
                  created.customerPrice ?? 0,
                )} (${created.effectiveDiscountPct}% off)`
            : ' — no App Store offer: the buyer pays full price, and the reseller earns commission on it'}
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
              setConfirmedDeviation(false);
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
              setConfirmedDeviation(false);
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
            {isFree
              ? ' — the buyer gets the plan free for a year through an App Store offer, then pays the regular price'
              : discountPct > 0
                ? `, ${discountPct}% discount to the buyer`
                : ', buyer pays full price'}
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
            {/* Apple's price-point catalogue runs to thousands of rows and a
                fetch that missed most of them used to land "nearest" on
                something wildly off target (5% requested, 64% actual, seen in
                practice). The math from here on is correct, but a mistake this
                expensive — selling a $69 plan for $25 for as long as the offer
                runs — deserves a second, explicit step rather than one click
                blending in with every ordinary case. */}
            {deviatesFromTarget ? (
              <div className="admin-price-warning">
                <p>
                  <strong>
                    That is {Math.round(deviationPct)} points off the {discountPct}% you set
                  </strong>{' '}
                  — check this is really the price point you want before creating a real,
                  un-cancellable offer.
                </p>
                <label className="admin-checkbox">
                  <input
                    type="checkbox"
                    checked={confirmedDeviation}
                    onChange={(e) => setConfirmedDeviation(e.target.checked)}
                  />
                  I've checked the price and want to create this offer anyway
                </label>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="admin-form-actions">
          {discountPct > 0 && !isFree ? (
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
            // offer is the irreversible half of this form. A preview that badly
            // misses the target additionally needs the checkbox above — the
            // preview alone was previously enough to submit even when it bore
            // no resemblance to what was asked for.
            disabled={
              busy ||
              !reseller ||
              code.trim().length < 4 ||
              (discountPct > 0 && !isFree && !preview) ||
              (deviatesFromTarget && !confirmedDeviation)
            }
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
