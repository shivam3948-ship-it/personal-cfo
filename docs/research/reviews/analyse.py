#!/usr/bin/env python3
"""Theme counts for app reviews (no names). Keyword rules, first-pass; every count computed here.
Usage: python3 analyse.py reviews_no_names.json"""
import json, re, sys, collections
rows = json.load(open(sys.argv[1]))
THEMES = {
    'insights_useful': r'\b(insight|analysis|analy[sz]e|x-?ray|review of my|portfolio review|health score|recommendation|suggest|rating[s]? of fund|in-?form|out-?of-?form|rank)\w*',
    'direct_regular': r'\b(direct plan|regular plan|commission|switch(ed|ing)? to direct)\b',
    'tax': r'\b(tax|ltcg|stcg|harvest|80c|elss)\w*',
    'overlap_diversify': r'\b(overlap|diversif)\w*',
    'returns_perf': r'\b(return|xirr|performance|underperform|outperform|beat)\w*',
    'advice_trust': r'\b(advis|expert|sebi|ria|trust|unbiased|honest)\w*',
    'ux_simple': r'\b(easy|simple|clean|intuitive|user friendly|smooth|ui\b|ux\b|interface)\w*',
    'bugs_login': r'\b(bug|crash|login|otp|not working|error|stuck|loading|glitch|slow)\w*',
    'cas_sync': r'\b(cas|sync|fetch|import|link(ed|ing)? (my )?(account|portfolio)|not showing|missing (fund|holding)|wrong (value|nav))\w*',
    'support': r'\b(support|customer care|no response|respond|reply|ticket|chat)\w*',
    'price_paywall': r'\b(subscription|paid|premium|price|pricing|fee|charges|paywall|expensive|refund)\w*',
    'spam_calls_upsell': r'\b(spam|calls?|upsell|push(ing)?|sales)\b',
    'upi_savings': r'\b(upi|liquid fund|savings?|interest|wallet|kyc)\w*',
    'ai_chat': r'\b(ai\b|chat|assistant|bot|gpt)\w*',
}
out = {}
for appname in sorted(set(r['app'] for r in rows)):
    rs = [r for r in rows if r['app'] == appname]
    n = len(rs); stars = collections.Counter(r['rating'] for r in rs)
    avg = round(sum(r['rating'] for r in rs) / n, 2) if n else None
    themes = {}
    for t, rx in THEMES.items():
        hit = [r for r in rs if re.search(rx, r['text'], re.I)]
        if hit:
            themes[t] = {'n': len(hit), 'pct': round(100 * len(hit) / n, 1), 'avg_star': round(sum(h['rating'] for h in hit) / len(hit), 2),
                         'neg': sum(1 for h in hit if h['rating'] <= 2), 'pos': sum(1 for h in hit if h['rating'] >= 4)}
    dates = sorted(r['date'] for r in rs if r['date'])
    out[appname] = {'n': n, 'avg': avg, 'stars': dict(sorted(stars.items())), 'from': dates[0] if dates else None, 'to': dates[-1] if dates else None,
                    'by_store': dict(collections.Counter(r['store'] for r in rs)), 'themes': dict(sorted(themes.items(), key=lambda kv: -kv[1]['n']))}
json.dump(out, open('themes.json', 'w'), indent=1)
for a, v in out.items():
    print(f"\n== {a}: {v['n']} reviews ({v['by_store']}), avg {v['avg']}, {v['from']}..{v['to']}, stars {v['stars']}")
    for t, s in list(v['themes'].items())[:8]: print(f"   {t:20s} n={s['n']:4d} ({s['pct']}%) avg★{s['avg_star']} neg={s['neg']} pos={s['pos']}")
