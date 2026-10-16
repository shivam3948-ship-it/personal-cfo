import pandas as pd, re, json
from codebook import THEMES
from load import load
from codebook import code, POSITIVE as _P
df=load(); df['themes']=df.text.map(code); df['pos']=df.text.map(lambda t: code(t, _P))
LOWQ = 'score<=3 and textlen>=20'
df['textlen']=df.text.str.len()
low=df.query(LOWQ)
SKIP={'permissions_privacy'}  # precision ~4/10 in check; excluded from findings
apps=['Bachatt','Jar','Groww','ET Money']
res={'n_total':len(df),'n_by_app':df.groupby('app').size().reindex(apps).to_dict(),
     'low_by_app':low.groupby('app').size().reindex(apps).to_dict(),
     'avg_score_sample':df.groupby('app').score.mean().round(2).reindex(apps).to_dict()}
tab={}
for k,(label,_) in THEMES.items():
    if k in SKIP: continue
    has=low.themes.map(lambda t:k in t)
    row={a:round(100*has[low.app==a].mean(),1) for a in apps}
    row['all_n']=int(has.sum()); row['all_pct']=round(100*has.mean(),1); row['label']=label
    tab[k]=row
res['themes_low']=dict(sorted(tab.items(), key=lambda kv:-kv[1]['all_pct']))
# savings apps (Bachatt+Jar) = Sunita-like
sav=low[low.app.isin(['Bachatt','Jar'])]
res['savings_apps_low_n']=len(sav)
res['savings_apps_theme_pct']={k:round(100*sav.themes.map(lambda t:k in t).mean(),1) for k in tab}
wd=sav[sav.themes.map(lambda t:'withdrawal_problem' in t)]
status=wd.text.str.contains(r'\b\d+\s*(?:days?|din|weeks?|hafte|months?|hours?|hrs?)\b|pending|processing|in ?progress|kab|when will|still not|abhi tak|अभी तक|कब|showing success|successful but|success but', case=False, regex=True)
res['savings_withdrawal_n']=len(wd); res['savings_withdrawal_with_timeline_or_status_pct']=round(100*status.mean(),1)
sup=sav.themes.map(lambda t:'support_unreachable' in t); wdh=sav.themes.map(lambda t:'withdrawal_problem' in t)
res['savings_withdrawal_and_support_pct_of_withdrawal']=round(100*(sup&wdh).sum()/wdh.sum(),1)
tf=sav.themes.map(lambda t:'trust_fraud' in t)
res['savings_fraud_given_withdrawal_pct']=round(100*(tf&wdh).sum()/wdh.sum(),1)
res['savings_fraud_given_no_withdrawal_pct']=round(100*(tf&~wdh).sum()/(~wdh).sum(),1)
# AI assistant mentions
ai=df.text.str.contains(r'\bsaathi\b|\bchat ?bot\b|\bbot\b|\bai\b|artificial intelligence|virtual assistant', case=False, regex=True)
res['ai_mentions_by_app']=df[ai].groupby('app').size().reindex(apps).fillna(0).astype(int).to_dict()
res['ai_mentions_avg_score']=df[ai].groupby('app').score.mean().round(2).reindex(apps).to_dict()
# language
dev=df.text.str.contains(r'[ऀ-ॿ]', regex=True)
hing=df.text.str.contains(r'\b(?:nahi|nahin|nhi|paisa|paise|pese|kar|hai|mera|mere|kya|bhi|kuch|raha|rha|gaya|gya|liye|aap|ko|se)\b', case=False, regex=True)&~dev
res['lang_by_app']={a:{'devanagari_pct':round(100*dev[df.app==a].mean(),1),'roman_hindi_pct':round(100*hing[df.app==a].mean(),1)} for a in apps}
res['lang_low_savings']={'devanagari_pct':round(100*dev[sav.index].mean(),1),'roman_hindi_pct':round(100*hing[sav.index].mean(),1)}
# positives among 4-5 star with text
from codebook import POSITIVE
hi=df[(df.score>=4)&(df.textlen>=20)]
res['high_n']=len(hi)
res['positives_high']={k:{a:round(100*hi[hi.app==a].pos.map(lambda t:k in t).mean(),1) for a in apps} for k in POSITIVE}
res['dev_reply_rate_low']=low.groupby('app').dev_replied.mean().mul(100).round(1).reindex(apps).to_dict()
res['uncoded_low_pct']=round(100*(low.themes.map(lambda t:len([x for x in t if x not in SKIP]))==0).mean(),1)
json.dump(res,open('results.json','w'),indent=1,ensure_ascii=False)
print(json.dumps(res,indent=1,ensure_ascii=False))
