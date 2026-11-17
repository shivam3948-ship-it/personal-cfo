# X-ray v3 extra numbers: fund overlap (synthetic sample holdings), FD comparison, "did it work" preview. Paise; as of 15 Oct 2026.
import json, re, datetime as dt
o = json.load(open('xray_v2_numbers.json'))
VAL = {'Kestrel': 55624980, 'Teak': 27897843, 'Banyan': 22165405, 'Monsoon': 9244022}  # CAS market values (equity funds)
# SYNTHETIC sample holdings (% of fund), for the demo only. Real build: AMFI monthly portfolio disclosures (D-OPEN-3).
H = {
 'Banyan': {'HDFC Bank': 13.0, 'ICICI Bank': 9.0, 'Reliance Industries': 8.5, 'Infosys': 5.0, 'Bharti Airtel': 4.5, 'Larsen & Toubro': 4.0, 'ITC': 3.5, 'TCS': 3.0, 'Axis Bank': 3.0, 'Kotak Mahindra Bank': 3.0, 'State Bank of India': 3.0, 'Mahindra & Mahindra': 2.5},
 'Kestrel': {'HDFC Bank': 9.0, 'ICICI Bank': 8.0, 'Reliance Industries': 5.0, 'Infosys': 4.0, 'Bharti Airtel': 4.0, 'Axis Bank': 3.5, 'Larsen & Toubro': 3.0, 'Kotak Mahindra Bank': 2.0, 'Mahindra & Mahindra': 2.0, 'Persistent Systems': 3.0, 'Max Healthcare': 2.5, 'Trent': 2.5, 'Dixon Technologies': 2.0},
 'Teak': {'HDFC Bank': 8.0, 'ICICI Bank': 7.0, 'Reliance Industries': 6.0, 'Infosys': 5.0, 'TCS': 4.0, 'ITC': 4.0, 'Larsen & Toubro': 3.5, 'State Bank of India': 3.0, 'Axis Bank': 3.0, 'Bharti Airtel': 3.0, 'Cipla': 2.0, 'Tata Motors': 2.0},
 'Monsoon': {'Karur Vysya Bank': 2.5, 'Cholamandalam Financial': 2.2, 'Navin Fluorine': 2.0, 'Kaynes Technology': 2.0, 'Brigade Enterprises': 1.8, 'Multi Commodity Exchange': 1.8},
}
pairs = []
names = list(H)
for i in range(len(names)):
    for j in range(i + 1, len(names)):
        a, b = names[i], names[j]
        ov = round(sum(min(H[a][s], H[b][s]) for s in set(H[a]) & set(H[b])), 1)
        pairs.append((a, b, ov))
pairs.sort(key=lambda p: -p[2])
eq = sum(VAL.values())
expo = {}
for f, hs in H.items():
    for s, w in hs.items(): expo.setdefault(s, {'paise': 0, 'funds': []}); expo[s]['paise'] += round(VAL[f] * w / 100); expo[s]['funds'].append(f)
top = sorted(expo.items(), key=lambda kv: -kv[1]['paise'])[:5]
top5 = sum(v['paise'] for _, v in top)
in3 = [s for s, v in expo.items() if len(v['funds']) >= 3]
a, b, ov = pairs[0]
dup = round(min(VAL[a], VAL[b]) * ov / 100)   # rupees in the smaller fund that mirror the bigger one's holdings
ovl = {'pairs': [[a, b, ov] for a, b, ov in pairs], 'top5': [[s, v['paise'], len(v['funds'])] for s, v in top], 'top5Paise': top5, 'top5PctOfEquity': round(top5 / eq * 100, 1),
       'in3plus': sorted(in3), 'dupPaise': dup, 'equityPaise': eq, 'asOf': 'Sep 2026 factsheets (synthetic sample)'}
# ---- FD comparison on the same cash flows (assumed 7% a year, before tax) ----
TXT = open('../../packages/core/data/demo-cas/sample_cas_rohan.txt').read()
MON = {m: i + 1 for i, m in enumerate('Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split())}
ASOF = dt.date(2026, 10, 15); fv = 0; invested = 0
for l in TXT.splitlines():
    m = re.match(r'^(\d{2})-([A-Za-z]{3})-(\d{4}) .*?([\d,]+\.\d{2}) [\d,]+\.\d{3}', ' '.join(l.split()))
    if m:
        d = dt.date(int(m.group(3)), MON[m.group(2)], int(m.group(1))); amt = float(m.group(4).replace(',', ''))
        fv += amt * 1.07 ** ((ASOF - d).days / 365); invested += amt
fd = {'rate': 7.0, 'invested': round(invested * 100), 'fdValue': round(fv * 100), 'actual': 127828450, 'extra': 127828450 - round(fv * 100)}
# ---- "did it work" preview: 3 months after acting on cards 1-2 (hypothetical, labelled Preview) ----
c = o['harvest']['combo']; months = 3
did = {'months': months, 'movedPaise': c['value'], 'feeSavedSoFar': round(c['feeSavedYr'] * months / 12), 'futureTax': round(c['gain'] * 0.125),
       'sipDirect': 700000 * months}
out = {'overlap': ovl, 'fd': fd, 'did': did}
json.dump(out, open('xray_v3_numbers.json', 'w'), indent=1)
print(json.dumps(out, indent=1))
