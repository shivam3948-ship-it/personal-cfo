"""Synthetic demo portfolios for the prototype. All funds fictional; all numbers computed here."""
import json, math
from datetime import date

def months(start, n):
    y, m = start.year, start.month
    for i in range(n):
        yield date(y + (m - 1 + i) // 12, (m - 1 + i) % 12 + 1, 5)

# Monthly market path Jan-2020 .. Sep-2026 (81 months): rally, 2022 drawdown, recovery
N = 81
mkt = []
for i in range(N):
    if i < 3: r = 0.012
    elif i < 5: r = -0.11 if i == 3 else 0.06      # covid crash + bounce
    elif i < 24: r = 0.022
    elif i < 34: r = -0.012                        # 2022 drawdown
    elif i < 60: r = 0.016
    elif i < 66: r = -0.009                        # 2025 wobble
    else: r = 0.013
    mkt.append(r)
dates = list(months(date(2020, 1, 1), N))
VAL_DATE = date(2026, 10, 1)

funds = {  # beta to market, alpha/month, TER%
  "Large Cap Fund A":        (0.95,  0.0000, 0.95),
  "Nifty 50 Index Fund A":   (1.00,  0.0000, 0.20),
  "Flexi-cap Fund A":        (1.05,  0.0008, 0.70),
  "Flexi-cap Fund B":        (1.05,  0.0002, 0.85),
  "Large & Mid Cap Fund A":  (1.10,  0.0005, 0.75),
  "Mid Cap Fund A":          (1.25,  0.0010, 0.65),
  "Small Cap Fund A":        (1.40,  0.0010, 0.70),
  "ELSS Fund A":             (1.05,  0.0004, 0.80),
  "Technology Fund A":       (1.30, -0.0004, 0.95),
  "Short Duration Debt Fund A": (0.0, 0.0057, 0.35),
}
nav = {}
for f, (b, a, _) in funds.items():
    v = [10.0]
    for r in mkt[1:]:
        v.append(v[-1] * (1 + b * r + a))
    nav[f] = v

flows = []  # (date, fund, amount)  + = invest
def sip(f, amt, start_i, end_i):
    for i in range(start_i, end_i):
        flows.append((dates[i], f, amt))
sip("Flexi-cap Fund A", 5000, 6, 81)
sip("Mid Cap Fund A", 4000, 18, 81)
sip("Small Cap Fund A", 3000, 22, 26); sip("Small Cap Fund A", 3000, 36, 81)   # stopped SIP in the fall
sip("Nifty 50 Index Fund A", 5000, 40, 81)
sip("Short Duration Debt Fund A", 2000, 60, 81)
# lumpsums after rallies (behaviour gap)
for i, f, amt in [(20, "Large Cap Fund A", 150000), (22, "Technology Fund A", 100000), (23, "Large & Mid Cap Fund A", 120000),
                  (26, "ELSS Fund A", 150000), (58, "Flexi-cap Fund B", 120000), (59, "ELSS Fund A", 150000), (74, "Flexi-cap Fund B", 80000)]:
    flows.append((dates[i], f, amt))
# panic redemption in the drawdown
flows.append((dates[31], "Technology Fund A", -60000))

units = {f: 0.0 for f in funds}; lots = {f: [] for f in funds}
for d, f, amt in sorted(flows):
    i = dates.index(d); u = amt / nav[f][i]
    units[f] += u
    if amt > 0: lots[f].append((d, u, nav[f][i]))
    else:
        rem = -u  # FIFO reduce
        while rem > 1e-9:
            d0, u0, p0 = lots[f][0]
            take = min(u0, rem); rem -= take
            lots[f][0] = (d0, u0 - take, p0)
            if lots[f][0][1] < 1e-9: lots[f].pop(0)
last = N - 1
value = {f: units[f] * nav[f][last] for f in funds}
total = sum(value.values())

def xirr(cfs):
    def npv(r): return sum(c / (1 + r) ** ((d - cfs[0][0]).days / 365.0) for d, c in cfs)
    lo, hi = -0.9, 1.0
    for _ in range(200):
        mid = (lo + hi) / 2
        if npv(mid) > 0: lo = mid
        else: hi = mid
    return mid
cfs = sorted([(d, -a) for d, f, a in flows]) + [(VAL_DATE, total)]
investor_xirr = xirr(cfs)
# "your funds' return": SIP-equivalent = xirr if same money had been invested steadily (monthly, same total net) — use value-weighted fund CAGR over holding window instead
def cagr(f, i0):
    yrs = (last - i0) / 12
    return (nav[f][last] / nav[f][i0]) ** (1 / yrs) - 1
first_i = {f: min(dates.index(d) for d, ff, a in flows if ff == f) for f in funds}
fund_ret = sum(value[f] * cagr(f, first_i[f]) for f in funds) / total
invested = sum(a for d, f, a in flows)
ter_cost = sum(value[f] * funds[f][2] / 100 for f in funds)

eq = sum(v for f, v in value.items() if "Debt" not in f)
out = {
  "rohan": {
    "total": round(total), "invested_net": round(invested), "gain": round(total - invested),
    "investor_xirr_pct": round(investor_xirr * 100, 1), "funds_return_pct": round(fund_ret * 100, 1),
    "equity_pct": round(eq / total * 100, 1), "debt_pct": round((total - eq) / total * 100, 1),
    "ter_cost_per_year": round(ter_cost), "n_funds": len(funds),
    "holdings": [{"fund": f, "value": round(value[f]), "ter": funds[f][2], "cagr_pct": round(cagr(f, first_i[f]) * 100, 1)} for f in sorted(funds, key=lambda x: -value[x])],
  }
}
json.dump(out, open("rohan.json", "w"), indent=1)
print(json.dumps({k: v for k, v in out["rohan"].items() if k != "holdings"}, indent=1))
for h in out["rohan"]["holdings"]: print(h)
import pickle; pickle.dump(dict(lots=lots, nav=nav, dates=dates, value=value, units=units, funds=funds, last=last), open("state.pkl", "wb"))
