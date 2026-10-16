import json, os, pandas as pd
# Raw file is NOT in the repo (review text stays off GitHub). Point REVIEWS_JSON at your local copy.
def load():
    d=json.load(open(os.environ.get('REVIEWS_JSON','playstore_reviews_2026-10-16.json')))
    df=pd.DataFrame(d['reviews'])
    df['app']=df.app.map({'app.bachatt.customer':'Bachatt','com.jar.app':'Jar','com.nextbillion.groww':'Groww','com.smartspends':'ET Money'})
    df['text']=df.text.fillna('')
    return df
