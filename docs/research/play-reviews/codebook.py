# Theme codebook v1 (16 Oct 2026). Built inductively from a random read of 140 low-rated reviews.
# Word-boundary regexes; English + Hinglish (roman) + Hindi (Devanagari). A review can carry several themes.
import re
W = lambda *ps: re.compile('|'.join(ps), re.I)
THEMES = {
 'withdrawal_problem': ('Withdrawal delayed, failed or stuck',
   W(r'withdr\w*|widr\w*|widhr\w*|withdra\w*|redeem\w*|redemption', r'\bnikal\w*|\bnikl\w*|निकाल\w*|निकल\w*', r'\bpaise? (?:wapas|vapas)|पैसे? वापस')),
 'got_less_than_put_in': ('Got back less than deposited / value lower than expected',
   W(r'(?:withdr\w*|got|get|received|receive|returned?|gave|giving|shows?|showing)\b[^.]{0,40}\b(?:only|less)\b|\bless than (?:i |what i |my |the )?(?:deposit|invest|sav|put|paid)\w*|\bkam (?:paise|amount|de\w*|mil\w*)|कम (?:पैसे|दे|मिल)',
     r'selling price|buying price|buy price|sell price|\bspread\b|\bgst\b|hidden charge|extra (?:money|charge|amount)|deduct\w* (?:extra|more)|\b\d(?:\.\d)?\s?%\s?(?:charge|deduct|gst|cut)')),
 'unexpected_debit': ('Money debited unexpectedly (autopay, multiple debits, fees without consent)',
   W(r'auto ?pay|auto ?debit|autodebit|e-?mandate|easypay',
     r'(?:debit\w*|deduct\w*|charged|cut|kat\w*)\b[^.]{0,40}without (?:my )?(?:consent|permission|information|informing|asking|notice|notification|reminder)|bina (?:bata\w*|puche|pooche|information)|बिना बता\w*',
     r'multiple (?:debits|deductions)|(?:debited|deducted) (?:twice|two times|multiple)|kat (?:liye|le|rahe|raha|gaye|gya)|\bpaise? kat\w*|पैसे? कट\w*|maintenance (?:fee|charge|ke naam)')),
 'debited_not_reflected': ('Debited but not shown / "in progress" / balance mismatch',
   W(r'investment in ?progress|(?:sip|order|payment|transaction|amount|money|investment) (?:is )?(?:still )?(?:in ?progress|pending|processing)|(?:amount|money|balance|investment|savings?) (?:is )?not (?:showing|reflect\w*|credited|updated|visible)',
     r'(?:deducted|debited|paid|payment (?:was )?successful)\b[^.]{0,60}\b(?:but|however)\b[^.]{0,60}(?:fail\w*|not|showing|pending)|not (?:credited|received) (?:in|to|into) (?:my )?(?:bank|account)|(?:paisa|paise|amount) (?:nahi|nhi|ni) (?:aaya|aya|aye|mila|dikh)|नहीं (?:आया|मिला|दिख)')),
 'support_unreachable': ('Support unreachable or unhelpful',
   W(r'customer (?:care|support|service)|support team|help ?line|helpdesk|\bsupport\b|whats ?app|call (?:center|centre|back)|on hold|no response|not respond\w*|no reply|not reply\w*|nobody|no one (?:picks|responds|replies|is)',
     r'phone (?:nahi|nhi|na) (?:utha|uthate)|फोन नहीं|कोई जवाब|jawab nahi')),
 'trust_fraud': ('Calls it fraud / scam / fake / unsafe',
   W(r'\bfraud\w*|\bfroa?d\w*|\bfrod\w*|\bscam\w*|\bfake\b|\bcheat\w*|\bchor\b|धोखा|फ्रॉड|फ्रोड|ठग|\bthug\w*|doob|डूब|safe(?:ty)?\b.*\?|run away')),
 'onboarding_kyc_bank': ('Sign-up, OTP, KYC, bank linking or bank change problems',
   W(r'\botp\b|\bkyc\b|verif\w*|\bpan\b|name mismatch|bank (?:change|link\w*|account (?:change|link\w*|add\w*))|aadhaa?r|penny drop|signature|passbook')),
 'app_bugs': ('App crashes, server down, glitches, forced updates',
   W(r'\bcrash\w*|glitch\w*|\bbugs?\b|\bbuggy\b|server|(?:app|it) (?:is )?(?:not|doesn.?t|didn.?t) (?:work\w*|open\w*|load\w*)|not (?:opening|loading)|blank screen|something went wrong|\boops\b|\bhangs?\b|\blags?\b|\blaggy\b|technical (?:issue|problem|error|glitch)|\berror\b|stuck on|update (?:is )?(?:stuck|broke|failed)|after (?:the |last |latest |recent )?update\w*[^.]{0,30}(?:not|crash|stuck|slow|error)')),
 'permissions_privacy': ('Asks for SMS, contacts, CIBIL or data sharing consent',
   W(r'permissions?\b|\bsms\b|contact list|cibil|third[- ]party|data (?:sharing|share|privacy)|privacy|(?:my|personal) data\b|marketing')),
 'paywall_fees': ('Paid plans, subscriptions or fees for basic features',
   W(r'\bpaid\b|paywall|subscription|premium|membership|\bgenius\b|charge\w* for (?:every|basic|each)|\bfees?\b|brokerage')),
 'pause_stop_hard': ('Hard to pause, skip, stop or cancel saving/SIP/autopay',
   W(r'\bskip\w*|\bpause\w*|stop (?:the )?(?:sip|saving|auto ?pay|mandate|daily)|cancel (?:the )?(?:sip|saving|auto ?pay|mandate|subscription)|band (?:kar|karna|nahi)|बंद (?:कर|नहीं)|rok\w* nahi')),
 'language': ('Wants support/app in their language',
   W(r'\blanguage\b|\bhindi\b|bengali|bangla|tamil|telugu|marathi|gujarati|kannada|regional|भाषा|हिंदी')),
 'confusing_ux': ('Confusing UI, features removed, hard to understand',
   W(r'confus\w*|complicated|difficult to (?:understand|use|find)|hard to (?:understand|use|find)|not user[- ]friendly|new ui|old ui|previous ui|interface|can\'?t find|could not find|unable to find')),
}
POSITIVE = {
 'easy_simple': W(r'\beasy\b|\bsimple\b|user[- ]friendly|smooth|aasan|आसान'),
 'saving_habit_small': W(r'daily (?:saving|save|invest\w*)|small (?:amount|saving)|habit|\broz\b|रोज़?|chhot\w* (?:amount|bachat)|bachat|बचत'),
 'fast_withdrawal': W(r'(?:instant|fast|quick|easy) (?:withdraw\w*|redemption)|withdraw\w* (?:is )?(?:instant|fast|quick|easy|within)'),
 'returns_interest': W(r'\breturns?\b|interest|profit|byaj|ब्याज|munafa|मुनाफ'),
 'good_support': W(r'(?:good|great|helpful|quick|fast) (?:support|customer (?:care|support|service)|service)'),
 'trust_safe': W(r'\bsafe\b|secure|trust\w*|bharosa|भरोसा|genuine'),
}
def code(text, book=THEMES):
    out=[]
    for k,v in book.items():
        rx = v[1] if isinstance(v, tuple) else v
        if rx.search(text or ''): out.append(k)
    return out
