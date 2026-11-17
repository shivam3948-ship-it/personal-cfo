import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { emptyDataset } from '@/lib/types';
import { runTool } from '@/lib/agent/tools';
import { parseCas } from '@/lib/portfolio/cas';
import { validatePortfolio } from '@/lib/portfolio/validate';
import { scrubForStorage } from '@/lib/session';
import { loadDemo } from '@/lib/demo';
import { intentOf } from '@/lib/agent/offline';

const cas = parseCas(fs.readFileSync(path.join(process.cwd(), 'data', 'demo-cas', 'sample_cas_rohan.txt'), 'utf8'));
const TOOLS = ['net_worth', 'sunday_briefing', 'money_overview', 'spending_breakdown', 'subscriptions_and_leaks', 'upcoming_dues', 'loans_overview', 'insurance_overview', 'credit_health', 'emergency_fund', 'advice_plan', 'portfolio_overview'];

describe('screens survive partial data', () => {
  it('every summary tool runs on an empty dataset and on a CAS-only dataset', async () => {
    for (const ds of [emptyDataset(), { ...emptyDataset(), portfolio: { asOf: cas.asOf, holdings: cas.holdings, checks: cas.checks, source: 'test' } }]) {
      for (const t of TOOLS) await expect(runTool(t, {}, { ds, sid: 'test-empty', lang: 'en' }), t).resolves.toBeDefined();
    }
  });
  it('net worth adds up: funds + bank − loans (sample family)', async () => {
    const ds = await loadDemo();
    const r = (await runTool('net_worth', {}, { ds, sid: 'nw', lang: 'en' })).result as Record<string, string>;
    const n = (s: string) => Number(s.replace(/[₹,]/g, ''));
    expect(Math.abs(n(r.mutual_funds) + n(r.bank_balance) - n(r.loans_outstanding) - n(r.net_worth))).toBeLessThanOrEqual(1); // rupee rounding
  });
});

describe('portfolio upload validation (server never trusts the browser)', () => {
  const good = { asOf: cas.asOf, holdings: cas.holdings, checks: cas.checks, source: 'Your CAS' };
  it('accepts the parser output', () => { expect(validatePortfolio(JSON.parse(JSON.stringify(good))).ok).toBe(true); });
  it('rejects PAN-shaped text, bad ISINs, floats for money and unknown plans', () => {
    const bad = (patch: Record<string, unknown>) => validatePortfolio({ ...good, holdings: [{ ...good.holdings[0], ...patch }] }).ok;
    expect(bad({ scheme: 'Fund ABCDE1234F' })).toBe(false);
    expect(bad({ isin: 'NOTANISIN' })).toBe(false);
    expect(bad({ value: 12.5 })).toBe(false);
    expect(bad({ plan: 'Gold' })).toBe(false);
    expect(validatePortfolio({ ...good, asOf: 'yesterday' }).ok).toBe(false);
  });
  it('drops fields it does not know (e.g. a folio number)', () => {
    const v = validatePortfolio({ ...good, holdings: [{ ...good.holdings[0], folio: '1023456/71', pan: 'x' }] });
    expect(v.ok && JSON.stringify(v.data)).not.toContain('1023456');
  });
});

describe('storage scrub', () => {
  it('document and notice text is redacted before it is saved', async () => {
    const ds = await loadDemo();
    const withPii = { ...ds, docs: [{ id: 'x', file: 'x.txt', kind: 'policy', text: 'Name: Rohan Saffron, phone 9876543210, email rohan@gmail.com' }] };
    const out = JSON.stringify(scrubForStorage(withPii).docs);
    expect(out).not.toContain('9876543210'); expect(out).not.toContain('rohan@gmail.com'); expect(out).not.toContain('Saffron');
  });
});

describe('offline intents for the new tools', () => {
  it('routes portfolio and net-worth questions, keeps emergency fund separate', () => {
    expect(intentOf('How are my mutual funds doing?')).toBe('portfolio');
    expect(intentOf('मेरा निवेश कैसा है')).toBe('portfolio');
    expect(intentOf('What is my net worth?')).toBe('networth');
    expect(intentOf('emergency fund kitne mahine ka hai')).toBe('emergency');
  });
});
