#!/usr/bin/env python3
"""Fetch public Play Store + App Store reviews for 6 Indian wealth apps (run on Shivam's Mac; the cloud sandbox can't reach the stores).
Keeps only: app, store, rating, date, text, thumbs-up, app version. Reviewer names and ids are dropped before saving.
Usage: python3 fetch_reviews.py <out_dir>"""
import json, sys, time, urllib.request, os
from google_play_scraper import app, reviews, Sort

OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True)
APPS = {  # name -> (Play package(s), App Store id)
    'PowerUp Money': (['money.powerup.uni.invest.app'], '6470202376'),
    'Stack Wealth': (['in.stackwealth.athena', 'co.stackfinance.stackwealth'], '6451255621'),
    'Tribe Money': (['ai.tribemoney.app'], None),
    'Curie Money': (['com.yield.curie_money'], '6446487532'),
}
meta, rows = {}, []
for name, (pkgs, ios) in APPS.items():
  for pkg in pkgs:
    m = meta.setdefault(name + ('' if pkg == pkgs[0] else ' (old app)'), {})
    if pkg:
        try:
            a = app(pkg, lang='en', country='in')
            m.update({'play_id': pkg, 'title': a.get('title'), 'developer': a.get('developer'), 'installs': a.get('installs'), 'realInstalls': a.get('realInstalls'),
                      'score': a.get('score'), 'ratings': a.get('ratings'), 'reviews_count': a.get('reviews'), 'released': a.get('released'), 'updated': a.get('lastUpdatedOn')})
            token, got = None, 0
            while got < 6000:
                batch, token = reviews(pkg, lang='en', country='in', sort=Sort.NEWEST, count=200, continuation_token=token)
                for r in batch:
                    rows.append({'app': name, 'pkg': pkg, 'store': 'play', 'rating': r.get('score'), 'date': str(r.get('at'))[:10], 'text': r.get('content') or '',
                                 'thumbs': r.get('thumbsUpCount'), 'version': r.get('reviewCreatedVersion'), 'reply': bool(r.get('replyContent'))})
                got += len(batch)
                if not batch or token is None or getattr(token, 'token', None) is None: break
                time.sleep(0.3)
            m['play_fetched'] = got
        except Exception as e:
            m['play_error'] = f'{type(e).__name__}: {e}'[:200]
  m = meta[name]
  if ios:
        got = 0
        for page in range(1, 11):
            url = f'https://itunes.apple.com/in/rss/customerreviews/page={page}/id={ios}/sortby=mostrecent/json'
            try:
                d = json.load(urllib.request.urlopen(url, timeout=20))
            except Exception as e:
                m['ios_error'] = f'{type(e).__name__}: {e}'[:200]; break
            entries = d.get('feed', {}).get('entry', [])
            if isinstance(entries, dict): entries = [entries]
            entries = [e for e in entries if 'im:rating' in e]
            if not entries: break
            for e in entries:
                rows.append({'app': name, 'store': 'ios', 'rating': int(e['im:rating']['label']), 'date': e.get('updated', {}).get('label', '')[:10],
                             'text': (e.get('title', {}).get('label', '') + '. ' + e.get('content', {}).get('label', '')).strip(), 'thumbs': None,
                             'version': e.get('im:version', {}).get('label'), 'reply': None})
            got += len(entries)
        m['ios_id'] = ios; m['ios_fetched'] = got
json.dump(meta, open(os.path.join(OUT, 'apps_meta.json'), 'w'), indent=1, default=str)
json.dump(rows, open(os.path.join(OUT, 'reviews_no_names.json'), 'w'), ensure_ascii=False)
print(json.dumps({k: {kk: v.get(kk) for kk in ('play_id', 'installs', 'score', 'ratings', 'play_fetched', 'ios_fetched', 'play_error', 'ios_error')} for k, v in meta.items()}, indent=1, default=str))
print('rows', len(rows))
