# Check the playbook's SIP vs lump-sum figures and make the "start at 30/40/50" table concrete
r=0.12; infl=0.06; n=120; P=10000
m_nom=r/12; m_eff=(1+r)**(1/12)-1
def fv_sip(m, due=True):
    f=P*((1+m)**n-1)/m
    return f*(1+m) if due else f
print("SIP nominal 1%/mo, annuity-due  :", round(fv_sip(m_nom,True)))
print("SIP nominal 1%/mo, end-of-month :", round(fv_sip(m_nom,False)))
print("SIP effective-rate, annuity-due :", round(fv_sip(m_eff,True)))
ls=1200000*(1+r)**10
print("Lump sum 12L x 1.12^10          :", round(ls))
print("Lump sum in today's rupees (6%) :", round(ls/(1+infl)**10))
print("SIP (1%/mo due) in today's rupees:", round(fv_sip(m_nom,True)/(1+infl)**10))
# Fair comparison: keep the 12L in a 7% FD/debt and move 10k/month into equity (STP-like) -> same as SIP equity leg + decaying debt leg
# Cost of delay: 10k/month to 60, 12% (1%/mo nominal, annuity-due)
def fv(Pm, months, m=m_nom): return Pm*((1+m)**months-1)/m*(1+m)
base=fv(10000,360)
for age in (30,40,50):
    months=(60-age)*12
    c=fv(10000,months)
    need=base/(((1+m_nom)**months-1)/m_nom*(1+m_nom))
    print(f"start {age}: corpus at 60 = {round(c):,} ; monthly SIP needed to match start-30 corpus = {round(need):,}")
