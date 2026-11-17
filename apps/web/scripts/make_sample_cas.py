#!/usr/bin/env python3
"""Writes a synthetic CAMS/KFintech-style detailed CAS (text) for the sample user, plus expected.json ground truth.
Deterministic (seed 19). All names, folios and ISINs are fictional. Run: npm run demo:cas"""
import json, math, random, datetime as dt, os
random.seed(19)
AS_OF = dt.date(2026, 10, 15)
OUT = os.path.join(os.path.dirname(__file__), '..', 'data', 'demo-cas')
# name, amc, code, category, asset, plan, sip, start, drift, vol, isin, folio
FUNDS = [
 ("Kestrel Flexi Cap Fund", "Kestrel Mutual Fund", "K01FC", "Flexi cap", "equity", "Regular", 5000, dt.date(2021,1,5), 0.13, 0.16, "INF000K01FC1", "1023456/71"),
 ("Banyan Nifty 50 Index Fund", "Banyan Mutual Fund", "B07IX", "Large cap index", "equity", "Direct", 3000, dt.date(2022,4,5), 0.11, 0.14, "INF000B07IX2", "5501234"),
 ("Monsoon Small Cap Fund", "Monsoon Mutual Fund", "M03SC", "Small cap", "equity", "Regular", 2000, dt.date(2023,6,5), 0.17, 0.24, "INF000M03SC3", "88412093/12"),
 ("Teak ELSS Tax Saver Fund", "Teak Mutual Fund", "T11EL", "ELSS", "equity", "Regular", 0, dt.date(2021,3,10), 0.12, 0.17, "INF000T11EL4", "3300981"),
 ("Lotus Short Duration Fund", "Lotus Mutual Fund", "L05SD", "Short duration", "debt", "Direct", 0, dt.date(2024,2,12), 0.07, 0.015, "INF000L05SD5", "7712004/33"),
]
LUMPS = {"Teak ELSS Tax Saver Fund": [(dt.date(2021,3,10),50000),(dt.date(2022,3,8),50000),(dt.date(2023,3,9),50000)],
         "Lotus Short Duration Fund": [(dt.date(2024,2,12),100000)]}
MON = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split()
fd = lambda d: f"{d.day:02d}-{MON[d.month-1]}-{d.year}"
def money(x):
    neg = x < 0; x = abs(x); r, p = f"{x:.2f}".split('.'); 
    if len(r) > 3:
        h, t = r[:-3], r[-3:]; parts = []
        while len(h) > 2: parts.insert(0, h[-2:]); h = h[:-2]
        if h: parts.insert(0, h)
        r = ','.join(parts) + ',' + t
    return ('-' if neg else '') + r + '.' + p
def months(start):
    d = start
    while d <= AS_OF:
        yield d
        m = d.month + 1; y = d.year + (m > 12); m = 1 if m > 12 else m
        d = dt.date(y, m, min(start.day, 28))

funds_out = []; lines = []
for name, amc, code, cat, asset, plan, sip, start, mu, vol, isin, folio in FUNDS:
    path = []; cur = 10.0
    for d in months(start):
        path.append((d, cur)); cur *= math.exp((mu - 0.5*vol*vol)/12 + vol/math.sqrt(12)*random.gauss(0, 1))
    nav_now = round(cur, 4)
    txns = []
    if sip:
        for i, (d, nv) in enumerate(path, 1): txns.append((d, f"SIP Purchase - Instalment {i}", sip, round(sip/nv, 3), round(nv, 4)))
    for d, amt in LUMPS.get(name, []):
        nv = min(path, key=lambda p: abs((p[0]-d).days))[1]
        txns.append((d, "Purchase", amt, round(amt/nv, 3), round(nv, 4)))
    txns.sort(key=lambda t: t[0])
    bal = 0.0; rows = []
    for d, desc, amt, u, nv in txns:
        bal = round(bal + u, 3); rows.append(f"{fd(d)} {desc} {money(amt)} {u:,.3f} {nv:.4f} {bal:,.3f}")
    cost = sum(t[2] for t in txns); value = round(bal * nav_now, 2)
    funds_out.append(dict(scheme=f"{name} - {plan} Plan - Growth", amc=amc, isin=isin, category=cat, asset=asset, plan=plan,
                          units=bal, nav=nav_now, cost=cost, value=value, flows=[(t[0].isoformat(), -t[2]) for t in txns]))
    lines += [amc, f"Folio No: {folio}   PAN: OK   KYC: OK", "Rohan Saffron",
              f"{code}RG-{name} - {plan} Plan - Growth - ISIN: {isin}(Advisor: {'ARN-000000' if plan=='Regular' else 'DIRECT'}) Registrar : CAMS",
              "Opening Unit Balance: 0.000", *rows,
              f"Closing Unit Balance: {bal:,.3f} NAV on {fd(AS_OF)}: INR {nav_now:.4f} Total Cost Value: {money(cost)} Market Value on {fd(AS_OF)}: INR {money(value)}", ""]

total_cost = sum(f['cost'] for f in funds_out); total_value = round(sum(f['value'] for f in funds_out), 2)
by_amc = {}
for f in funds_out: c, v = by_amc.get(f['amc'], (0, 0)); by_amc[f['amc']] = (c + f['cost'], round(v + f['value'], 2))
head = ["Consolidated Account Statement", f"01-Jan-2021 To {fd(AS_OF)}", "Rohan Saffron", "Flat 12, Example Road, Bengaluru 560076", "Email Id: r*****@example.com  Mobile: +91XXXXXX3210", "",
        "PORTFOLIO SUMMARY", "Mutual Fund Cost Value Market Value",
        *[f"{a} {money(c)} {money(v)}" for a, (c, v) in by_amc.items()], f"Total {money(total_cost)} {money(total_value)}", ""]
open(os.path.join(OUT, 'sample_cas_rohan.txt'), 'w').write('\n'.join(head + lines))

def xirr(flows):
    d0 = flows[0][0]
    npv = lambda r: sum(a / (1 + r) ** ((d - d0).days / 365) for d, a in flows)
    lo, hi = -0.99, 5.0
    for _ in range(200):
        mid = (lo + hi) / 2
        if npv(mid) > 0: lo = mid
        else: hi = mid
    return mid
allf = []
for f in funds_out:
    fl = sorted((dt.date.fromisoformat(d), a) for d, a in f['flows']) + [(AS_OF, f['value'])]
    f['xirr_pct'] = round(xirr(fl) * 100, 2); allf += [(dt.date.fromisoformat(d), a) for d, a in f['flows']]
assert abs(sum(f['value'] for f in funds_out) - total_value) < 0.01
exp = dict(as_of=AS_OF.isoformat(), total_cost=total_cost, total_value=total_value,
           xirr_pct=round(xirr(sorted(allf) + [(AS_OF, total_value)]) * 100, 2),
           funds=[{k: f[k] for k in ('scheme', 'isin', 'plan', 'asset', 'units', 'nav', 'cost', 'value', 'xirr_pct')} for f in funds_out])
json.dump(exp, open(os.path.join(OUT, 'expected.json'), 'w'), indent=1)
print(json.dumps({k: exp[k] for k in ('total_cost', 'total_value', 'xirr_pct')}))
