import pickle, json
from datetime import date
s = pickle.load(open("state.pkl","rb")); lots, nav, dates, value, funds, last = s["lots"], s["nav"], s["dates"], s["value"], s["funds"], s["last"]
TODAY = date(2026,10,3)
# SAMPLE tax assumptions (label in UI; real values come from config/tax_rules.yaml with sources)
LTCG_RATE, STCG_RATE, EXEMPT = 0.125, 0.20, 125000
EXIT_LOAD, EXIT_LOAD_DAYS = 0.01, 365
def lot_view(f):
    p = nav[f][last]; out=[]
    for d,u,c in lots[f]:
        age=(TODAY-d).days
        out.append(dict(date=d.isoformat(), units=u, cost=u*c, value=u*p, gain=u*(p-c), long=age>365, age_days=age))
    return out
exempt_left = EXEMPT
# R1: Large Cap Fund A -> Nifty 50 Index Fund A, all lots
L = lot_view("Large Cap Fund A")
g1 = sum(l["gain"] for l in L); v1 = sum(l["value"] for l in L)
taxable1 = max(0, g1 - exempt_left); tax1 = taxable1*LTCG_RATE; exempt_left -= min(exempt_left, max(g1,0))
ter_save1 = v1*(0.95-0.20)/100
net5_1 = ter_save1*5 - tax1
# R2: Flexi-cap Fund B -> Flexi-cap Fund A: long lots now, short lots wait
F = lot_view("Flexi-cap Fund B")
long_l=[l for l in F if l["long"]]; short_l=[l for l in F if not l["long"]]
gL=sum(l["gain"] for l in long_l); vL=sum(l["value"] for l in long_l)
taxL=max(0,gL-exempt_left)*LTCG_RATE; exempt_left-=min(exempt_left,max(gL,0))
gS=sum(l["gain"] for l in short_l); vS=sum(l["value"] for l in short_l)
now_cost_short = max(0,gS)*STCG_RATE + vS*EXIT_LOAD          # if sold today
wait_cost_short = max(0,gS)*LTCG_RATE                         # after it turns long-term (next FY exemption may also apply; ignored = conservative)
short_turns = [l["date"] for l in short_l]
ter_save2 = (vL+vS)*(0.85-0.70)/100
# R3: rebalance via SIP redirection to target equity 80%
T=sum(value.values()); D=value["Short Duration Debt Fund A"]; TARGET_DEBT=0.20; SIP=19000
X=(TARGET_DEBT*T - D)/(1-TARGET_DEBT); months_sip = X/SIP
# faster: route R1 proceeds (after tax) into debt instead of the index fund
proceeds1 = v1 - tax1
debt_after = (D+proceeds1)/T
out=dict(
 r1=dict(value=round(v1),gain=round(g1),tax=round(tax1),ter_saving_yr=round(ter_save1),net_5yr=round(net5_1)),
 r2=dict(long_value=round(vL),long_gain=round(gL),long_tax=round(taxL),short_value=round(vS),short_gain=round(gS),
         cost_if_sold_now=round(now_cost_short),cost_if_wait=round(wait_cost_short),saving_by_waiting=round(now_cost_short-wait_cost_short),
         short_lot_dates=short_turns,ter_saving_yr=round(ter_save2)),
 r3=dict(total=round(T),debt=round(D),debt_pct=round(D/T*100,1),target_debt_pct=20,extra_debt_needed=round(X),
         months_via_sip=round(months_sip,1),sip_total=SIP,debt_pct_if_r1_proceeds_to_debt=round(debt_after*100,1)),
 exemption_used=round(EXEMPT-exempt_left))
json.dump(out,open("advice.json","w"),indent=1); print(json.dumps(out,indent=1))
# check: reconcile subtotals
assert abs(sum(l["value"] for l in L)-value["Large Cap Fund A"])<1
assert abs(vL+vS-value["Flexi-cap Fund B"])<1
print("reconciled ok")
