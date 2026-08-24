import { useState } from 'react';
import { useToast } from '../../components/toast-context';
import {
  createPayout,
  markPayoutPaid,
  type PromoDashboard,
  type ResellerBalance,
} from '../../api/admin';

/**
 * What the app owner is here to see: money owed, and the means to settle it.
 *
 * Everything on this screen is derived from frozen amounts on individual
 * redemptions, never recomputed from a code's current rate — so the figures do
 * not move when a code is edited.
 */

interface Props {
  dashboard: PromoDashboard;
  onChanged: () => void;
}

export function Balances({ dashboard, onChanged }: Props) {
  const { totals } = dashboard;

  return (
    <div className="admin-stack">
      <div className="admin-tiles">
        <Tile
          label="Owed now"
          value={money(totals.commissionUnpaid)}
          hint="Commission accrued and not yet paid out"
          tone={totals.commissionUnpaid > 0 ? 'attention' : undefined}
        />
        <Tile label="Redemptions" value={String(totals.redemptions)} hint="Sales attributed to a code" />
        <Tile
          label="Revenue attributed"
          value={money(totals.grossAttributed)}
          hint={`Net of Apple's ${dashboard.storeCutPct}%: ${money(totals.netAttributed)}`}
        />
        <Tile
          label="Refunded"
          value={String(totals.reversed)}
          hint="Reversed — no longer owed"
          tone={totals.reversed > 0 ? 'bad' : undefined}
        />
      </div>

      {totals.overLimit > 0 ? (
        <p className="admin-warning">
          <strong>{totals.overLimit}</strong>{' '}
          {totals.overLimit === 1 ? 'redemption was' : 'redemptions were'} accepted past a code&apos;s
          unit limit. The purchases are real and commission is owed — but a block sold more than it
          was meant to.
        </p>
      ) : null}

      <section className="admin-panel">
        <h2>Resellers</h2>
        {dashboard.byReseller.length === 0 ? (
          <p className="admin-muted">No resellers yet.</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Reseller</th>
                <th className="admin-num">Codes</th>
                <th className="admin-num">Sales</th>
                <th className="admin-num">Revenue</th>
                <th className="admin-num">Earned</th>
                <th className="admin-num">Owed</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {dashboard.byReseller.map((r) => (
                <ResellerRow key={r.id} reseller={r} onChanged={onChanged} />
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="admin-panel">
        <h2>Payouts</h2>
        {dashboard.payouts.length === 0 ? (
          <p className="admin-muted">No payouts yet.</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Created</th>
                <th>Reseller</th>
                <th className="admin-num">Sales</th>
                <th className="admin-num">Amount</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {dashboard.payouts.map((p) => (
                <PayoutRow key={p.id} payout={p} onChanged={onChanged} />
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="admin-panel">
        <h2>Recent redemptions</h2>
        {dashboard.recent.length === 0 ? (
          <p className="admin-muted">
            Nothing yet. A redemption is recorded when someone buys a subscription with a code.
          </p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Code</th>
                <th>Reseller</th>
                <th>Plan</th>
                <th className="admin-num">Paid</th>
                <th className="admin-num">Commission</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.recent.map((r) => (
                <tr key={r.id} className={r.status === 'reversed' ? 'admin-row-off' : undefined}>
                  <td className="admin-nowrap">{new Date(r.created_at).toLocaleDateString()}</td>
                  <td>
                    <span className="admin-code">{r.code ?? '—'}</span>
                  </td>
                  <td>{r.reseller ?? '—'}</td>
                  <td>{r.applies_to}</td>
                  <td className="admin-num">{money(r.gross_amount, r.currency_code)}</td>
                  <td className="admin-num">{money(r.commission_amount, r.currency_code)}</td>
                  <td>
                    {r.status === 'reversed' ? (
                      <span className="admin-pill admin-pill-bad">refunded</span>
                    ) : r.over_limit ? (
                      <span className="admin-pill admin-pill-warn">over limit</span>
                    ) : (
                      <span className="admin-pill">counted</span>
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

function ResellerRow({
  reseller,
  onChanged,
}: {
  reseller: ResellerBalance;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function pay() {
    setBusy(true);
    try {
      const result = await createPayout(reseller.id);
      toast.success(
        `Payout created for ${reseller.name}`,
        `${money(result.commission_due)} across ${result.redemption_count} ${
          result.redemption_count === 1 ? 'sale' : 'sales'
        }. Mark it paid once the money has actually been sent.`,
      );
      onChanged();
    } catch (e) {
      toast.error('Could not create payout', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr className={reseller.is_active ? undefined : 'admin-row-off'}>
      <td>
        {reseller.name}
        <span className="admin-tier">{tierName(reseller.tier)}</span>
      </td>
      <td className="admin-num">{reseller.codes}</td>
      <td className="admin-num">{reseller.redemptions}</td>
      <td className="admin-num">{money(reseller.gross)}</td>
      <td className="admin-num">{money(reseller.commission)}</td>
      <td className="admin-num">
        <strong>{money(reseller.unpaid)}</strong>
      </td>
      <td>
        {reseller.unpaid > 0 ? (
          <button type="button" className="admin-btn-quiet" disabled={busy} onClick={() => void pay()}>
            {busy ? 'Working…' : 'Create payout'}
          </button>
        ) : null}
      </td>
    </tr>
  );
}

function PayoutRow({
  payout,
  onChanged,
}: {
  payout: PromoDashboard['payouts'][number];
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [reference, setReference] = useState('');
  const toast = useToast();

  async function markPaid() {
    setBusy(true);
    try {
      await markPayoutPaid(payout.id, reference.trim() || undefined);
      toast.success(
        `Marked paid: ${money(payout.commission_due, payout.currency_code)}`,
        `${payout.reseller ?? 'Reseller'} is settled up.`,
      );
      onChanged();
    } catch (e) {
      toast.error('Could not mark as paid', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr>
      <td className="admin-nowrap">{new Date(payout.created_at).toLocaleDateString()}</td>
      <td>{payout.reseller ?? '—'}</td>
      <td className="admin-num">{payout.redemption_count}</td>
      <td className="admin-num">{money(payout.commission_due, payout.currency_code)}</td>
      <td>
        {payout.status === 'paid' ? (
          <>
            <span className="admin-pill admin-pill-good">paid</span>
            {payout.reference ? <div className="admin-tier">{payout.reference}</div> : null}
          </>
        ) : (
          <span className="admin-pill admin-pill-warn">{payout.status}</span>
        )}
      </td>
      <td>
        {payout.status !== 'paid' ? (
          <div className="admin-pay-row">
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Reference"
              aria-label="Payment reference"
            />
            <button type="button" className="admin-btn-quiet" disabled={busy} onClick={() => void markPaid()}>
              {busy ? 'Saving…' : 'Mark paid'}
            </button>
          </div>
        ) : null}
      </td>
    </tr>
  );
}

function Tile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'attention' | 'bad';
}) {
  return (
    <div className={`admin-tile${tone ? ` admin-tile-${tone}` : ''}`}>
      <span className="admin-tile-value">{value}</span>
      <span className="admin-tile-label">{label}</span>
      {hint ? <span className="admin-tile-hint">{hint}</span> : null}
    </div>
  );
}

function tierName(tier: string): string {
  if (tier === 'free') return 'Free / testers';
  if (tier === 'a') return 'Reseller A';
  if (tier === 'b') return 'Reseller B';
  return tier;
}

function money(n: number, currency = 'CAD'): string {
  return Number(n).toLocaleString(undefined, { style: 'currency', currency });
}
