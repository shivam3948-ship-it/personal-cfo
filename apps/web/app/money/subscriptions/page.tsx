'use client';
import { useState } from 'react';
import { useApp } from '../../client';
import { Empty, Screen, ShowMath, WithSummary, fmtDate } from '../../ui';

const CTA: Record<string, { label: string; kind?: string; reminder?: boolean }> = {
  cancel: { label: 'Draft cancel email', kind: 'cancel_subscription' },
  cancel_and_refund: { label: 'Ask for a refund', kind: 'refund_request' },
  dispute: { label: 'Dispute the charge', kind: 'dispute_charge' },
  ask_waiver: { label: 'Ask for a waiver', kind: 'fee_waiver' },
  review_plan: { label: 'Remind me to review', reminder: true },
};
interface Item { kind: string; what: string; merchant: string; amount: string; per_year: string; deadline?: string; suggested_action: string }

export default function Subscriptions() {
  const { api } = useApp();
  const [done, setDone] = useState<Record<string, string>>({});
  const act = async (it: Item) => {
    const c = CTA[it.suggested_action]; if (!c) return;
    setDone((d) => ({ ...d, [it.what]: 'Working…' }));
    const remindOn = it.deadline ? new Date(Date.parse(it.deadline) - 2 * 86400000).toISOString().slice(0, 10) : null;
    const req = c.reminder ? { tool: 'create_reminder', input: { title: `Review ${it.merchant} before the price change`, date: remindOn ?? '' } } : { tool: 'draft_email', input: { kind: c.kind!, merchant: it.merchant } };
    const r = await api('/api/actions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(req) });
    const j = await r.json().catch(() => ({}));
    setDone((d) => ({ ...d, [it.what]: j.action ? (j.action.duplicate ? 'Already saved in You → Actions' : 'Saved to You → Actions') : (j.result?.error ?? j.error ?? 'Could not do that') }));
  };
  return (
    <Screen title="Subscriptions" back={{ href: '/money', label: 'Money' }}>
      <WithSummary>{(s) => {
        const r = s.subscriptions_and_leaks ?? {}; const items = (r.items ?? []) as Item[];
        if (!items.length) return <Empty title="No subscriptions found" body="Add bank and card statements, SMS alerts or emails so Munim can find recurring charges." cta={{ href: '/you#files', label: 'Add files' }} />;
        const leaks = items.filter((x) => x.kind !== 'subscription'); const subs = items.filter((x) => x.kind === 'subscription');
        return (<>
          <div className="topbar" style={{ minHeight: 0 }}><span className="sub">{r.subscription_count} running</span><b className="mono" style={{ fontSize: 18 }}>{r.all_subscriptions_per_year}/yr</b></div>
          {!!leaks.length && <div className="eyebrow">Money leaking · {leaks.length}</div>}
          {leaks.map((it) => (
            <div key={it.what} className="card" style={{ display: 'grid', gap: 8, padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <span><b style={{ fontSize: 14 }}>{it.what}</b>{it.deadline && <small style={{ display: 'block', fontSize: 12, color: 'var(--muted)' }}>Act by {fmtDate(it.deadline)}</small>}</span>
                <span className="mono neg" style={{ whiteSpace: 'nowrap', fontSize: 13.5 }}>{it.per_year}/yr</span>
              </div>
              {CTA[it.suggested_action] && (done[it.what] ? <span className="sub">{done[it.what]}</span> : <button className="btn small" style={{ justifySelf: 'start', borderColor: 'var(--green)', color: 'var(--green-ink)' }} onClick={() => void act(it)}>{CTA[it.suggested_action].label}</button>)}
            </div>
          ))}
          {!!subs.length && <div className="card" style={{ display: 'grid', gap: 6, fontSize: 13 }}>
            <b style={{ fontSize: 13 }}>All subscriptions</b>
            {subs.map((x) => <div key={x.what} style={{ display: 'flex', justifyContent: 'space-between' }}><span>{x.what}</span><span className="mono">{x.per_year}/yr</span></div>)}
          </div>}
          <span className="sub" style={{ fontSize: 12 }}>Drafts are never sent for you: open them from You → Actions.</span>
          <ShowMath data={r} />
        </>);
      }}</WithSummary>
    </Screen>
  );
}
