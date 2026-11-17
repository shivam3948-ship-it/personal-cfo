# X-ray v2 insight numbers from the sample CAS (synthetic). All money in paise; FIFO lots; as of 15 Oct 2026.
import re, json, datetime as dt
TXT = open('../../packages/core/data/demo-cas/sample_cas_rohan.txt').read()
ASOF = dt.date(2026, 10, 15); FY_START = dt.date(2026, 4, 1); FY_END = dt.date(2027, 3, 31)
EXEMPT = 12500000  # ₹1.25 lakh LTCG exemption per FY (Budget 2024; verify for FY 2026-27)
LTCG, STCG = 0.125, 0.20
MON = {m: i+1 for i, m in enumerate('Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split())}
d = lambda s: dt.date(int(s[7:]), MON[s[3:6]], int(s[:2]))
num = lambda s: float(s.replace(',', '').replace('(', '-').replace(')', ''))
TER_GAP = {'equity': 0.009, 'index': 0.004, 'debt': 0.005}  # engine TER_GAP_ESTIMATE (estimate)
funds = []; cur = None
for line in TXT.splitlines():
    l = ' '.join(line.split())
    m = re.search(r'-(.+?) - ISIN', l)
    if 'ISIN:' in l:
        name = re.sub(r'^[A-Z0-9]{2,12}-', '', l.split(' - ISIN')[0]); cur = {'name': name, 'lots': [], 'plan': 'Direct' if 'Direct' in name else 'Regular'}; funds.append(cur); continue
    t = re.match(r'^(\d{2}-[A-Za-z]{3}-\d{4}) (.+?) (\(?-?[\d,]+\.\d{2}\)?) (\(?-?[\d,]+\.\d{3,4}\)?) ([\d,]+\.\d{2,4}) (\(?-?[\d,]+\.\d{3,4}\)?)$', l)
    if t and cur is not None:
        cur['lots'].append({'date': d(t.group(1)), 'amt': round(num(t.group(3)) * 100), 'units': num(t.group(4)), 'nav': num(t.group(5))}); continue
    c = re.search(r'NAV on (\S+): INR ([\d,]+\.\d+)', l)
    if c and cur is not None: cur['navNow'] = num(c.group(2))
short = lambda n: n.split(' Fund')[0]
out = {}
for f in funds:
    f['short'] = short(f['name'])
    f['cat'] = 'index' if 'Index' in f['name'] else 'debt' if 'Duration' in f['name'] else 'equity'
    f['elss'] = 'ELSS' in f['name']
    for lot in f['lots']:
        lot['value'] = round(lot['units'] * f['navNow'] * 100); lot['cost'] = lot['amt']; lot['gain'] = lot['value'] - lot['cost']
        lot['days'] = (ASOF - lot['date']).days; lot['long'] = lot['days'] > 365
        lot['locked'] = f['elss'] and lot['date'].replace(year=lot['date'].year + 3) > ASOF
    f['value'] = sum(l['value'] for l in f['lots'])
print({f['short']: (f['plan'], f['value'], len(f['lots'])) for f in funds})

# ---- Insight 1: regular -> direct ----
reg = [f for f in funds if f['plan'] == 'Regular']
rows = []
for f in reg:
    fee = round(f['value'] * TER_GAP[f['cat']])
    sip = [l for l in f['lots'] if l['amt'] == 500000 or l['amt'] == 200000]
    lt = [l for l in f['lots'] if l['long'] and not l['locked']]; st = [l for l in f['lots'] if not l['long'] and not l['locked']]
    rows.append({'fund': f['short'], 'value': f['value'], 'feeYr': fee, 'ltGain': sum(l['gain'] for l in lt), 'ltValue': sum(l['value'] for l in lt),
                 'stGain': sum(l['gain'] for l in st), 'stValue': sum(l['value'] for l in st), 'lockedValue': sum(l['value'] for l in f['lots'] if l['locked'])})
feeTotal = sum(r['feeYr'] for r in rows)
ltGainReg = sum(r['ltGain'] for r in rows)
taxIfSwitchAllLT = round(max(0, ltGainReg - EXEMPT) * LTCG)  # move all long-term units now, using this FY's exemption
ltValueReg = sum(r['ltValue'] for r in rows)
feeOnLT = round(sum(r['ltValue'] * TER_GAP['equity'] for r in rows))  # regular funds are all equity here
payback_months = round(taxIfSwitchAllLT / (feeOnLT / 12), 1) if feeOnLT else None
# monthly SIP into regular plans (future money): Kestrel 5,000 + Monsoon 2,000
sipReg = 500000 + 200000
out['regular'] = {'rows': rows, 'feeTotal': feeTotal, 'ltGainReg': ltGainReg, 'taxIfSwitchAllLT': taxIfSwitchAllLT, 'ltValueReg': ltValueReg, 'feeOnLT': feeOnLT, 'paybackMonths': payback_months,
                  'sipReg': sipReg, 'sipFeeFirstYr': round(sipReg * 12 * TER_GAP['equity'] / 2)}  # avg balance ~half of a year's SIPs
# ---- Insight 2: tax-free gains this FY ----
realised = 0  # no redemptions in the CAS this FY
eq_lt = [(f, l) for f in funds if f['cat'] != 'debt' for l in f['lots'] if l['long'] and not l['locked']]
ltGainAll = sum(l['gain'] for _, l in eq_lt)
harvest = min(EXEMPT - realised, ltGainAll)
out['harvest'] = {'exempt': EXEMPT, 'used': realised, 'left': EXEMPT - realised, 'ltGainAll': ltGainAll, 'harvest': harvest, 'taxSavedLater': round(harvest * LTCG), 'deadline': '2027-03-31',
                  'daysLeft': (FY_END - ASOF).days}
# a harvest plan that also moves regular -> direct: sell the regular long-term lots with the most gain per rupee? keep simple: oldest lots first until gains reach the limit
plan, g, v = [], 0, 0
for f in sorted(reg, key=lambda f: f['short']):
    for l in sorted([l for l in f['lots'] if l['long'] and not l['locked']], key=lambda l: l['date']):
        if g + l['gain'] > harvest: break
        g += l['gain']; v += l['value']; plan.append((f['short'], l['date'].isoformat()))
out['harvest']['combo'] = {'gain': g, 'value': v, 'lots': len(plan), 'feeSavedYr': round(v * TER_GAP['equity']), 'funds': sorted(set(p[0] for p in plan))}
# ---- Insight 3: ELSS units out of lock-in ----
el = [f for f in funds if f['elss']][0]
free = [l for l in el['lots'] if not l['locked']]
out['elss'] = {'fund': el['short'], 'plan': el['plan'], 'freeValue': sum(l['value'] for l in free), 'freeGain': sum(l['gain'] for l in free), 'lots': [(l['date'].isoformat(), l['amt'], l['value']) for l in free],
               'lockedValue': sum(l['value'] for l in el['lots'] if l['locked'])}
# ---- Insight 4: fund vs a plain Nifty 50 index fund on your dates (index NAVs = Banyan's, where the dates match) ----
idx = {l['date']: l['nav'] for l in [f for f in funds if f['cat'] == 'index'][0]['lots']}
idxNow = [f for f in funds if f['cat'] == 'index'][0]['navNow']
cmp = {}
for f in funds:
    if f['cat'] != 'equity': continue
    cov = [l for l in f['lots'] if l['date'] in idx]
    if len(cov) != len(f['lots']): cmp[f['short']] = {'covered': len(cov), 'of': len(f['lots']), 'note': 'index NAVs missing for some dates'}; continue
    idxUnits = sum(l['amt'] / 100 / idx[l['date']] for l in cov)
    cmp[f['short']] = {'covered': len(cov), 'of': len(f['lots']), 'invested': sum(l['amt'] for l in cov), 'fundValue': f['value'], 'indexValue': round(idxUnits * idxNow * 100), 'diff': f['value'] - round(idxUnits * idxNow * 100)}
out['vsIndex'] = cmp
print(json.dumps(out, indent=1, default=str))
json.dump(out, open('xray_v2_numbers.json', 'w'), indent=1, default=str)
