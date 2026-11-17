# Bachatt-specific codebook v1 (16 Oct 2026), built from reading 110 low-rated and 45 high-rated Bachatt reviews.
import re
W = lambda *ps: re.compile('|'.join(ps), re.I)
WD = r'withdr\w*|widr\w*|widhr\w*|withdra\w*|wid?hral|whidr\w*|withral|nikal\w*|nikl\w*|निकाल\w*|निकल\w*|redeem\w*|redemption'
T = {
 'withdrawal_any': ('Any withdrawal problem (umbrella)',
   W(WD, r'paise? (?:nahi|nhi|ni) (?:aata|aate|milta|deta|dete|aaya|aya)|पैसा (?:नहीं|नही) (?:आता|देता|मिलता)|wapas (?:nahi|nhi|ni)|vapas (?:nahi|nhi)|money (?:is )?(?:locked|block\w*|stuck)|pesa ko fasa|paisa fas|पैसा फ़सा')),
 'wd_cannot': ('"Withdrawal doesn\'t happen" / unable to withdraw at all',
   W(rf'(?:{WD})\s*(?:nahi|nhi|ni|nahin|na)\s*(?:hota|hoga|ho raha|ho rha|deta|dete|mila|milta)|(?:unable|not able|can.?t|cannot|impossible) to (?:withdraw|redeem)|not withdraw(?:ing|al)?\b|withdrawal (?:issue|problem)s?|withdraw problem')),
 'wd_slow_pending': ('Withdrawal slow or stuck "in process" for days',
   W(rf'(?:{WD})[^.]{{0,80}}(?:\d+\s*(?:-|to)?\s*\d*\s*(?:days?|din|weeks?|hafte|months?|mahine)|pending|process\w*|progress|slow|late|let\b|der\b|wait|intezar|intzaar|time lag|lambaa|lamba)',
     rf'(?:\d+\s*(?:days?|din|weeks?|months?)|pending|processing|in ?progress|slow|late|wait|delay\w*|long time|postpone\w*|mahine)[^.]{{0,60}}(?:{WD})', rf'(?:{WD})[^.]{{0,60}}(?:delay\w*|long time|postpone\w*|mahine|month|block)', r'दो तीन दिन|2-3 din|2,3 din|3 to 5 working|1 mahine')),
 'wd_success_not_credited': ('Shows "withdrawn/successful" but money not in bank',
   W(r'(?:success\w*|done|completed|credited|withdrawn|send ho|sent|dikha\w*|likha aaya|shows?|showing)[^.]{0,90}(?:not (?:been |actually )?(?:credited|received|come|reflect\w*|reached)|haven.?t (?:actually )?(?:reached|come|been credited)|didn.?t (?:receive|get|come)|nahi aa?ya|nhi aa?ya|ni aa?ya|aata (?:nahi|nhi|ni)|account (?:me|mein) (?:nahi|nhi|ni)|nahin hota|still same|never (?:credited|came|reached)|kah?a?n gye|kaha gaye|balance check)',
     r'(?:not credited|never credited|didn.?t receive)[^.]{0,60}(?:success|withdrawn|shows)')),
 'wd_failed_cancelled': ('Withdrawal failed, cancelled or rejected', W(rf'(?:{WD})[^.]{{0,60}}(?:fail\w*|cancel\w*|reject\w*)', rf'(?:fail\w*|cancel\w*|reject\w*)[^.]{{0,40}}(?:{WD})')),
 'wd_partial': ('Can only withdraw part (70/30, half, "not full amount")',
   W(r'\b70\s?%|\b30\s?%|\b90\s?%|\bhalf\b|\badha\b|\baadha\b|आधा|pura (?:paisa|payment|fund|amount)? ?(?:nahi|nhi|ni)|not (?:able to |allow\w* (?:me )?to )?withdraw (?:the )?(?:full|entire|all)|full amount|entire amount|only (?:permitted|allowed)|permitted me to (?:take|withdraw)|on hold|put on hold|blocked|cheque|chaek|check bhej')),
 'deposit_not_reflected': ('Money debited but investment "in progress", failed or missing',
   W(r'investment in ?progress|in ?progress|(?:sip|investment|payment|amount)[^.]{0,30}(?:failed|not (?:showing|added|reflect\w*|invested))|(?:deducted|debited|cut)[^.]{0,50}(?:but|lekin)[^.]{0,50}(?:fail\w*|not|nahi|nhi|zero|0\b|show)|balance (?:was |is )?(?:zero|0\b)|show(?:s|ing|n)? (?:in )?only|showing (?:less)|dikha raha|not (?:invested|allotted)|invest nahin hua')),
 'double_or_unwanted_debit': ('Autopay took more than set, twice, or after cancelling',
   W(r'double|twice|2 times|two times|multiple (?:times|debit\w*)|do baar|दो बार|kai bar|many times', r'auto ?pay[^.]{0,80}(?:without|marzi|after|even after|continue|still|any amount)|(?:after|even after)[^.]{0,40}(?:cancel\w*|uninstall\w*|deactivat\w*)[^.]{0,60}(?:deduct\w*|debit\w*|kat)')),
 'fees_charges': ('Fees: ₹49 Elite/maintenance/"AMC" charge, commission, tax, unexplained deduction',
   W(r'\b49\b|elite|membership|maintenance|\bamc charge\w*|account maintenance|annual fee|subscription|charges?\b|commission|\bfees?\b|\btax\b|\bgst\b|deduct\w* (?:without|extra|more)|hidden|kat (?:lete|liya|lete hai)|cut kr|payment cut')),
 'received_less': ('Got back less than put in', W(r'(?:received|got|get|mila|aaye|reflecting|credited|cerid)[^.]{0,30}\bonly\b|\b\d{2,6} only\b|\bless\b[^.]{0,20}(?:than|amount|money|deposit)|\bloss\b|nuksan|नुकसान|ghata|2000 deposit[^.]*1500|kam (?:paise|amount|de)')),
 'unauthorised_product': ('Gold/silver or another plan added without consent', W(r'(?:gold|silver)[^.]{0,60}(?:without|consent|authori[sz]|marzi|automatic)|without (?:my )?(?:consent|permission|authori[sz]ation)[^.]{0,60}(?:gold|silver)')),
 'folio_split': ('Each daily saving creates a separate folio', W(r'folio')),
 'otp_bank_kyc': ('OTP, KYC, PAN, penny-drop or bank-change problems', W(r'\botp\b|\bkyc\b|\bpan\b|pancard|verif\w*|bank (?:change|account change)|change (?:withdrawal )?ba?n?k|add bank|\b1 rs\b|\b2 rs\b|penny')),
 'loan_calls': ('Loan section: rejections, high rates, spam calls', W(r'\bloans?\b|ram fan|interest rate|calls? (?:atleast|daily|everyday|\d)')),
 'data_permissions': ('CIBIL check, permissions, data/contacts access', W(r'cibil|credit score|permission|\bcontacts?\b|third party|data collect|consent tick|bank account details|\bsms\b')),
 'referral_reward': ('Referral bonus or reward not received', W(r'refer\w*|reward|bonus|cashback')),
 'support_bad': ('Support unreachable, scripted or unhelpful', W(r'customer (?:care|support|service)|castomer|costumer|support|helpline|whats ?app|no response|not respond\w*|call (?:kar|disconnect)|disconnect\w*|phone (?:nahi|nhi|na) utha|number pe|contact number')),
 'ad_promise_mismatch': ('Ads/listing promised "instant withdrawal" or "no charges"', W(r'\bads?\b|advertis\w*|\badd me\b|promis\w*|instant withdrawal|claim\w*|misleading|ऐड|विज्ञापन|show(?:s|ing)? (?:you )?instant|bolti (?:hai )?1 din|1 din bol')),
 'returns_low': ('Returns low or worse than FD/other options', W(r'returns? (?:is |are )?(?:low|less|same|kam|nahi)|\b7-8\s?%|same hi return|fd (?:is )?better|not profitable|no profit|profit (?:nahi|kam)')),
 'trust_fraud': ('Calls it fraud / scam / fake / chor', W(r'\bfraud\w*|\bfroa?u?d\w*|\bfrod\w*|\bscam\w*|\bfake\b|\bcheat\w*|\bchor\b|\bloot\w*|लूट|धोखा|फ्रॉड|फ्रोड|\bdoob|डूब|farzi|thief|thiefs|bogus')),
}
POS = {
 'habit_daily_small': W(r'habit|daily (?:saving|save|sip|invest\w*)|roz|रोज़?|small (?:amount|saving|investment)|chhot\w*|₹?\s?(?:30|40|50|51|100|101) (?:daily|rs|rupee)|zero stress'),
 'easy_simple': W(r'\beasy\b|\bsimple\b|user[- ]friendly|smooth|aasan|आसान|clean'),
 'got_money_back': W(r'(?:withdraw\w*|wapis|vapas|वापस)[^.]{0,40}(?:ho g|easy|fast|quick|instant|mil g|received|success|impressed|de bhi)'),
 'wait_and_see': W(r'(?:let.?s )?see (?:the result|how|what)|dekhte (?:hai|h)|dekhta hai|abhi (?:to |tak )?(?:start|shuru|शुरू)|just (?:started|joined|install)|joined now|started (?:today|now)|शुरू किया|will see|hope\w*|उम्मीद'),
 'returns': W(r'\breturns?\b|interest|profit|byaj|ब्याज|munafa'),
 'safe_trust': W(r'\bsafe\b|secure|trust\w*|bharosa|भरोसा|genuine|verified'),
}
def code(text, book=T):
    out=[]
    for k,v in book.items():
        rx = v[1] if isinstance(v, tuple) else v
        if rx.search(text or ''): out.append(k)
    return out
