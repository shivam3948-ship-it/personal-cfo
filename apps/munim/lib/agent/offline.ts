// Rule-based fallback agent: no LLM, same tools, bilingual templates. Keeps the demo alive with no network or API key.
import { runTool, type ToolCtx } from './tools';
import { checkNumbers } from '@core/agent/guard';
import { parseAmountRupees } from '@core/agent/lang';
import type { AgentReply, TraceStep, Turn } from './claude';
import type { Action } from '@/lib/actionsCore';
import { addMonths, spokenDate } from '@core/dates';

type Pending = { tool: string; input: Record<string, unknown> } | null;
const pendingBySid = new Map<string, Pending>();
export const clearPending = (sid: string) => pendingBySid.delete(sid);

const INTENTS: [string, RegExp][] = [
  // Devanagari is not \w in JS regex, so word ends are lookaheads, not \b.
  ['confirm', /^(?:\s*(?:haan|han|ha|haa|yes|yeah|yep|ok|okay|sure|please|kar do|karo|kardo|kar dijiye|theek hai|thik hai|ji|bilkul|हाँ|हां|हा|जी|ठीक है|कर दो|करो|कर दीजिए|बिल्कुल|प्लीज़)(?=[\s.!,।]|$)[\s.!,।]*)+$/i],
  // asking for an identifier: never read one out (eval pii-*)
  ['private', /\b(pan|aadhaa?r|password|otp|cvv|upi pin)\b|account (no|number)|card (no\.?|number)|email (address|id)|my e-?mail|पैन|आधार|पासवर्ड|खाता नंबर|कार्ड नंबर/i],
  ['claim', /claim|hospital|admit|surgery|operation|cataract|अस्पताल|क्लेम|ऑपरेशन|मोतियाबिंद|भर्ती|सर्जरी/i],
  // specific fund words first, so "switch to direct plans" isn't read as a loan switch
  ['portfolio', /mutual fund|direct plan|regular plan|\bdirect\b|portfolio|xirr|\belss\b|tax.?free gain|ltcg|harvest|पोर्टफोलियो|म्यूचुअल|डायरेक्ट|रेगुलर प्लान/i],
  // "how much is left on my loan" is the loan's own status, not a rate negotiation (eval *-loanleft)
  ['loanleft', /(kitna|kitni|kitne) (baaki|baki|bacha|bache)|बाकी|बचा है|बचे हैं|left on|outstanding|how much (do i )?(still )?owe|(loan|emi)s? (left|remaining)|remaining (loan|emi|balance)/i],
  ['negotiate', /negotiat|rate (kam|reduce|cut|lower)|interest kam|byaj kam|ब्याज कम|सस्ता|offer|switch|balance transfer|better (rate|terms)|refinanc/i],
  ['prepay', /prepay|pre-pay|jaldi chuka|jaldi band|close (my|the) loan|chukana|chuka (du|doon|sakta|sakti)|पहले चुका|जल्दी चुका|चुका (दूं|दूँ|सकता|सकती)/i],
  ['draft', /\bdraft|\bemail\b|\bmail\b|ईमेल|refund|रिफ़ंड|रिफंड|dispute|शिकायत|letter/i],
  ['remind', /remind|yaad dila|याद दिला|reminder|रिमाइंडर/i],
  ['goal', /\bgoal\b|save for|saving for|save (₹|rs\.?\s?)?[\d,.]+\s*(lakh|lac|k|thousand|hazaar|हज़ार|लाख)?\s*(for|by)\b|bachana hai|लक्ष्य|जमा करना/i],
  // how the month went in money terms: income, spending, committed, surplus (eval en-saved, en-surplus)
  ['overview', /how much (did|do|have) i (save|saved)|did i save|saved last month|(monthly|my) surplus|savings rate|income (vs|and) (spend|expense)|kitna bacha(ya)? (is|pichhle) mahine|बचत कितनी|कितनी बचत/i],
  ['advice', /what should i (do|fix)|fix first|what do i do|next step|priorit|advice|advise|suggest|pehle kya|पहले क्या|kya karu|kya karun|kya karna chahiye|salah|सलाह|क्या करूँ|क्या करूं|क्या करना चाहिए|सुझाव/i],
  ['briefing', /sunday|weekly|week|summary|how am i doing|kya chal|kaisa chal|haal|money call|हाल|सारांश|हफ़्ते|हफ्ते|कैसा चल|क्या चल/i],
  ['subscriptions', /don[’']?t use|not using|unused|istemal nahi|इस्तेमाल नहीं|subscri|cancel|netflix|cult|gym|leak|trial|lingopro|सब्सक्रिप्शन|रद्द|बंद कर/i],
  ['unusual', /unusual|ajeeb|spike|weird|zyada kharch|असामान्य|अजीब|ज़्यादा खर्च|ज्यादा खर्च/i],
  ['credit', /credit score|cibil|\bscore\b|स्कोर|सिबिल/i],
  ['upcoming', /upcoming|due|aane wale|kab (hai|tak)|bill(s)?\b|payment|देय|आने वाले|बिल|भुगतान/i],
  ['insurance', /insured|insurance|policy|bima|बीमा|पॉलिसी|term plan|cover/i],
  ['invest', /where (should|do|can) i (invest|put)|invest(ing)? (₹|rs\.?\s?)?\d|spare money|extra money|surplus|kahan invest|kaha invest|कहाँ (निवेश|लगा)|कहां (निवेश|लगा)|बची रकम/i],
  ['emergency', /without (a |my )?(salary|income|job)|lose my job|job (chali|gayi|chhut)|bina salary|emergency|safety.?net|buffer|kitne mahine|कितने महीने|इमरजेंसी/i],
  ['portfolio', /\bfunds?\b|return|tax.?free|टैक्स.?फ़?्री|फ़ंड|फंड|रिटर्न/i],
  ['loans', /loan|emi|लोन|ईएमआई/i],
  ['spend', /where|kahan|kahaan|kharch|spend|spent|money go|paisa|खर्च|कहाँ|कहां|पैसा/i],
];

export function intentOf(text: string): string {
  for (const [k, re] of INTENTS) if (re.test(text)) return k;
  return 'help';
}

const MONTHS: [RegExp, number][] = [[/jan|जनवरी/i, 1], [/feb|फ़?फरवरी|फ़रवरी/i, 2], [/mar|मार्च/i, 3], [/apr|अप्रैल/i, 4], [/may|मई/i, 5], [/jun|जून/i, 6], [/jul|जुलाई/i, 7], [/aug|अगस्त/i, 8], [/sep|सितंबर|सितम्बर/i, 9], [/oct|अक्टूबर|अक्तूबर/i, 10], [/nov|नवंबर|नवम्बर/i, 11], [/dec|दिसंबर|दिसम्बर/i, 12]];
/** "31 Oct" / "31 अक्टूबर" → the next such date on or after asOf (YYYY-MM-DD), else null. */
function dayMonth(text: string, asOf: string): string | null {
  const m = text.match(/(\d{1,2})\s*(?:st|nd|rd|th)?\s+([A-Za-z\u0900-\u097F]+)/);
  if (!m || !asOf) return null;
  const mon = MONTHS.find(([re]) => re.test(m[2]))?.[1]; const day = Number(m[1]);
  if (!mon || day < 1 || day > 31) return null;
  let y = Number(asOf.slice(0, 4)); const iso = (yy: number) => `${yy}-${String(mon).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  if (iso(y) < asOf) y += 1;
  return iso(y);
}
const loanHi = (s: unknown) => String(s).replace(/^car loan/i, 'कार लोन').replace(/^personal loan/i, 'पर्सनल लोन').replace(/^home loan/i, 'होम लोन');

export async function runOffline(history: Turn[], ctx: ToolCtx): Promise<AgentReply> {
  const t0 = Date.now();
  const text = history.filter((t) => t.role === 'user').at(-1)?.content ?? '';
  const hi = ctx.lang === 'hi';
  const trace: TraceStep[] = []; const actions: Action[] = []; const results: unknown[] = [];
  const call = async (tool: string, input: Record<string, unknown> = {}) => {
    const s = Date.now(); const out = await runTool(tool, input, ctx);
    trace.push({ tool, input, result: out.result, ms: Date.now() - s }); results.push(out.result); if (out.action && !(out.action as { duplicate?: boolean }).duplicate) actions.push(out.action);
    return out.result as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  };
  const say = (h: string, e: string) => (hi ? h : e);
  const d = (iso?: string | null) => (iso ? spokenDate(iso, ctx.lang) : '');
  let answer = ''; let next: Pending = null;
  const loose = /^\s*(haan|han|haa|yes|yeah|ok|okay|sure|ji|theek|thik|हाँ|हां|जी|ठीक)\b/i.test(text) && text.trim().split(/\s+/).length <= 6;
  const intent = pendingBySid.get(ctx.sid) && loose ? 'confirm' : intentOf(text);
  const pending = pendingBySid.get(ctx.sid) ?? null;

  if (intent === 'confirm' && pending) {
    const r = await call(pending.tool, pending.input);
    pendingBySid.set(ctx.sid, null);
    if (r.error) answer = say(`यह नहीं हो पाया: ${r.error}`, `That didn't work: ${r.error}`);
    else if (pending.tool === 'draft_email') answer = say(`ड्राफ़्ट तैयार है: "${r.subject}"। इसे Actions में देखकर भेज दीजिए।`, `Done. I've drafted "${r.subject}". Review it in Actions and send it when ready.`);
    else if (pending.tool === 'create_reminder') answer = say(`रिमाइंडर सेट: ${r.title}, ${d(r.date)}। कैलेंडर फ़ाइल Actions में है।`, `Reminder set: ${r.title} on ${d(r.date)}. The calendar file is in Actions.`);
    else if (pending.tool === 'save_prepayment_plan') answer = say(`प्लान सेव: ${r.plan}, ${d(r.date)} को। इससे ब्याज में ${r.interest_saved} बचेंगे।`, `Saved: ${r.plan} on ${d(r.date)}. That saves ${r.interest_saved} in interest.`);
    else answer = say('हो गया।', 'Done.');
  } else switch (intent) {
    case 'confirm': // a yes with nothing waiting: acknowledge, don't recite the help text
      answer = say('ठीक है। और कुछ पूछना है?', 'Okay. Anything else?');
      break;
    case 'help':
      answer = say('मैं आपके बैंक, कार्ड, लोन, बीमा और क्रेडिट रिपोर्ट से जवाब देता हूँ। पूछिए: "मेरा पैसा कहाँ जा रहा है?", "कौन से सब्सक्रिप्शन बेकार हैं?", या "क्या मैं लोन जल्दी चुका सकता हूँ?"', 'I answer from your bank, card, loan, insurance and credit documents. Try: "Where is my money going?", "Which subscriptions should I cut?", or "Can I prepay my loan?"');
      break;
    case 'briefing': {
      const b = await call('sunday_briefing');
      const m = b.last_complete_month; const lk = b.leaks?.[0]; const cf = b.cashflow;
      answer = say(
        `${m ? `${m.month} में आमदनी ${m.income} थी और बचत ${m.surplus} रही। ` : ''}${lk ? `सबसे ज़रूरी बात: ${lkHi(lk)}। ` : ''}सैलरी से पहले ${cf.dues_total} के भुगतान बाकी हैं; उसके बाद खाते में ${cf.balance_after_dues} बचेंगे।${lk ? ' क्या मैं इसके लिए ईमेल ड्राफ़्ट कर दूँ?' : ''}`,
        `${m ? `In ${m.month} you earned ${m.income} and saved ${m.surplus}. ` : ''}${lk ? `Top flag: ${lk.what}${lk.deadline ? `, act by ${d(lk.deadline)}` : ''}. ` : ''}You have ${cf.dues_total} due before salary, leaving ${cf.balance_after_dues} in the account.${lk ? ' Shall I draft the email for it?' : ''}`);
      if (lk) next = { tool: 'draft_email', input: { kind: hintToDraft(lk.suggested_action), merchant: lk.merchant ?? merchantOf(lk.what) } };
      break;
    }
    case 'spend': {
      const r = await call('spending_breakdown');
      const top = (r.categories ?? []).filter((c: any) => c.group === 'spend').slice(0, 3); // eslint-disable-line @typescript-eslint/no-explicit-any
      const u = (await call('unusual_spending')).items?.find((x: any) => x.kind === 'category_spike'); // eslint-disable-line @typescript-eslint/no-explicit-any
      answer = say(
        `${r.month} में कुल ${r.total_outflow} गए: ${r.true_spend} खर्च और ${r.committed} EMI, SIP और बीमा में। सबसे बड़े खर्च: ${top.map((c: any) => `${c.hindi} ${c.amount}`).join(', ')}।${u ? ` ${u.what.replace(/ up /, ' में बढ़त ').replace(/ in \d{4}-\d{2}/, '')}।` : ''} क्या मैं सब्सक्रिप्शन भी देखूँ?`, // eslint-disable-line @typescript-eslint/no-explicit-any
        `In ${r.month}, ${r.total_outflow} went out: ${r.true_spend} on spending and ${r.committed} on EMIs, SIP and insurance. Biggest: ${top.map((c: any) => `${c.category} ${c.amount}`).join(', ')}.${u ? ` ${u.what.replace(/ in \d{4}-\d{2}/, '')} versus your usual.` : ''} Want me to check your subscriptions too?`); // eslint-disable-line @typescript-eslint/no-explicit-any
      next = null;
      break;
    }
    case 'draft':
    case 'subscriptions': {
      const r = await call('subscriptions_and_leaks');
      const all = (r.items ?? []) as { kind: string; what: string; merchant: string; amount: string; per_year: string; deadline?: string; suggested_action: string }[];
      const low = text.toLowerCase();
      // A merchant the user named ("What about LingoPro?") beats the generic summary.
      const named = all.find((x) => x.kind !== 'subscription' && x.merchant && low.includes(x.merchant.toLowerCase().split(/[ .]/)[0]));
      const wantKind = /refund|रिफ़ंड|रिफंड|trial/i.test(text) ? 'refund_request' : /dispute|duplicate|twice|दो बार|शिकायत/i.test(text) ? 'dispute_charge' : /fee|charge waiver|चार्ज/i.test(text) ? 'fee_waiver' : /rate|ब्याज|interest/i.test(text) ? 'rate_reduction' : null;
      if (intent === 'draft' && (wantKind || named)) {
        const kind = wantKind ?? hintToDraft(named!.suggested_action);
        const target = named ?? all.find((x) => hintToDraft(x.suggested_action) === kind);
        const d2 = await call('draft_email', { kind, merchant: target?.merchant });
        answer = d2.error ? say(`यह नहीं हो पाया: ${d2.error}`, `I couldn't do that: ${d2.error}`) : say(`ड्राफ़्ट तैयार है: "${d2.subject}"। Actions में देखकर भेज दीजिए।`, `Drafted "${d2.subject}" to ${d2.to}. Review it in Actions and send it.`);
        break;
      }
      if (named) {
        answer = say(`${named.what}: ${named.amount}${named.deadline ? `, आख़िरी तारीख ${d(named.deadline)}` : ''}। क्या मैं ईमेल ड्राफ़्ट करूँ?`, `${named.what}: ${named.amount}${named.deadline ? `, deadline ${d(named.deadline)}` : ''}, ${named.per_year} a year. Shall I draft the email?`);
        next = { tool: 'draft_email', input: { kind: hintToDraft(named.suggested_action), merchant: named.merchant } };
        break;
      }
      const items = all.filter((x) => x.kind !== 'subscription' && x.kind !== 'fee');
      const first = items[0];
      answer = say(
        `आपके ${r.subscription_count} सब्सक्रिप्शन पर साल में ${r.all_subscriptions_per_year} जाते हैं। ${items.slice(0, 3).map((x: any) => lkHi(x)).join('; ')}।${first ? ' क्या मैं पहले वाले के लिए ईमेल ड्राफ़्ट करूँ?' : ''}`, // eslint-disable-line @typescript-eslint/no-explicit-any
        `Your ${r.subscription_count} subscriptions cost ${r.all_subscriptions_per_year} a year. ${items.slice(0, 3).map((x: any) => `${x.what} (${x.per_year}/yr)`).join('; ')}.${first ? ' Shall I draft the email for the first one?' : ''}`); // eslint-disable-line @typescript-eslint/no-explicit-any
      if (first) next = { tool: 'draft_email', input: { kind: hintToDraft(first.suggested_action), merchant: first.merchant } };
      break;
    }
    case 'advice': {
      const r = await call('advice_plan');
      const steps = (r.steps ?? []) as AdviceStep[];
      const todo = steps.filter((x) => x.status === 'todo');
      const [a, b] = todo.length ? todo : steps.filter((x) => x.status === 'review');
      answer = say(
        `सबसे पहले: ${a ? adviceHi(a) : 'कुछ ज़रूरी नहीं।'}${b ? ` उसके बाद: ${adviceHi(b)}` : ''} ${r.disclaimer}`,
        `First: ${a?.recommendation ?? 'nothing urgent.'}${b ? ` Then: ${b.recommendation}` : ''} ${r.disclaimer}`);
      break;
    }
    case 'unusual': {
      const r = await call('unusual_spending');
      const it = (r.items ?? []).slice(0, 3);
      answer = say(`ये खर्च अलग दिखे: ${it.map((x: any) => `${x.what}`).join('; ')}।`, `These stood out: ${it.map((x: any) => x.what).join('; ')}.`); // eslint-disable-line @typescript-eslint/no-explicit-any
      break;
    }
    case 'upcoming': {
      const r = await call('upcoming_dues');
      const ds = (r.dues ?? []).slice(0, 4);
      const c = r.cashflow_until_salary;
      answer = say(
        `आने वाले भुगतान: ${ds.map((x: any) => `${d(x.date)} को ${x.what} ${x.amount}`).join(', ')}। सैलरी से पहले कुल ${c.dues_before_salary}; उसके बाद ${c.balance_after_dues} बचेंगे। क्या मैं कार्ड बिल का रिमाइंडर लगा दूँ?`, // eslint-disable-line @typescript-eslint/no-explicit-any
        `Coming up: ${ds.map((x: any) => `${x.what} ${x.amount} on ${d(x.date)}`).join(', ')}. ${c.dues_before_salary} is due before salary, leaving ${c.balance_after_dues}. Shall I set a reminder for the card bill?`); // eslint-disable-line @typescript-eslint/no-explicit-any
      const card = (r.dues ?? []).find((x: any) => /card/i.test(x.what)); // eslint-disable-line @typescript-eslint/no-explicit-any
      if (card) next = { tool: 'create_reminder', input: { title: say(`क्रेडिट कार्ड बिल ${card.amount}`, `Pay credit card bill ${card.amount}`), date: prevDay(card.date), notes: card.note ?? '' } };
      break;
    }
    case 'prepay': {
      const amount = parseAmountRupees(text) ?? 50000;
      const loanQ = /personal|पर्सनल|orbit/i.test(text) ? 'personal' : 'car';
      const r = await call('simulate_prepayment', { loan: loanQ, amount_rupees: amount });
      if (r.error) { answer = r.error; break; }
      const alt = r.other_loans?.[0];
      answer = r.allowed_now
        ? say(`${loanHi(r.loan)} में ${r.prepay} अभी जमा करने से ब्याज में ${r.interest_saved} बचेंगे और ${r.months_saved} EMI कम होंगी। लेकिन सैलरी से पहले के भुगतानों के बाद खाते में ${r.balance_after_dues_and_prepayment} ही बचेंगे।${alt && !alt.allowed_now ? ` पर्सनल लोन में ${d(alt.allowed_from)} से पहले प्रीपेमेंट नहीं हो सकता।` : ''} क्या मैं सैलरी के बाद का प्लान सेव कर दूँ?`,
          `Prepaying ${r.prepay} on your ${r.loan} saves ${r.interest_saved} in interest and ${r.months_saved} EMIs. But after the dues before salary, your account would be left with ${r.balance_after_dues_and_prepayment}.${alt && !alt.allowed_now ? ` The other loan can't be part-prepaid until ${d(alt.allowed_from)}.` : ''} Shall I save a plan for just after salary?`)
        : say(`${loanHi(r.loan)} में ${d(r.allowed_from)} से पहले प्रीपेमेंट की इजाज़त नहीं है।`, `Your ${r.loan} can't be part-prepaid until ${d(r.allowed_from)}.`);
      if (r.allowed_now) next = { tool: 'save_prepayment_plan', input: { loan: loanQ, amount_rupees: amount, date: r.next_salary ?? '' } };
      break;
    }
    case 'negotiate':
    case 'loans': {
      const r = await call('loan_negotiation');
      if (r.error || !r.offer) { const o = await call('loans_overview'); answer = say(`आपकी कुल EMI ${o.total_emi_per_month} महीना है, आमदनी का ${o.emi_share_of_income}।`, `Your EMIs total ${o.total_emi_per_month} a month, ${o.emi_share_of_income} of income.`); break; }
      answer = say(
        `${String(r.offer).replace(' at ', ' का ')} वाला ऑफ़र है, पर लोन बदलने पर ${r.switch_costs.foreclosure_charge_incl_gst} फ़ोरक्लोज़र चार्ज लगेगा, तो ${String(r.switch_net_saving).startsWith('-') ? `उल्टा ${String(r.switch_net_saving).slice(1)} का नुकसान होगा` : `कुल फ़ायदा ${r.switch_net_saving} है`}${r.offer_expires_before_switch_allowed ? `, और ऑफ़र ${d(r.offer_valid_till)} को खत्म हो जाएगा` : ''}। बेहतर है ${r.loan.split('(')[1]?.replace(')', '') ?? 'अपने लेंडर'} से यही रेट माँगें, तो बिना फ़ीस ${r.if_current_lender_matches_rate.saving} बचेंगे। क्या मैं रेट कम करने का ईमेल ड्राफ़्ट करूँ?`,
        `${r.offer} looks cheaper, but switching costs ${r.switch_costs.foreclosure_charge_incl_gst} in foreclosure charges, so ${String(r.switch_net_saving).startsWith('-') ? `you'd lose ${String(r.switch_net_saving).slice(1)}` : `the net saving is ${r.switch_net_saving}`}${r.offer_expires_before_switch_allowed ? `, and the offer expires on ${d(r.offer_valid_till)}, before you're even allowed to foreclose` : ''}. Asking your current lender to match the rate saves ${r.if_current_lender_matches_rate.saving} with no fees. Shall I draft that request?`);
      next = { tool: 'draft_email', input: { kind: 'rate_reduction' } };
      break;
    }
    case 'private':
      answer = say('मैं PAN, आधार, खाता या कार्ड नंबर, पासवर्ड या आपका ईमेल कभी नहीं पढ़ता। मुनीम खाते और कार्ड के सिर्फ़ आख़िरी 4 अंक रखता है।',
        'I never read out PAN, Aadhaar, account or card numbers, passwords or your email. Munim keeps only the last 4 digits of an account or card.');
      break;
    case 'loanleft': {
      const o = await call('loans_overview');
      const loans = (o.loans ?? []) as { loan: string; lender: string; emi: string; emis_left: number; outstanding: string; ends: string }[];
      const pick = /car|कार/i.test(text) ? loans.filter((l) => /car/i.test(l.loan)) : /personal|पर्सनल/i.test(text) ? loans.filter((l) => /personal/i.test(l.loan)) : /home|ghar|घर|होम/i.test(text) ? loans.filter((l) => /home/i.test(l.loan)) : loans;
      const list = pick.length ? pick : loans;
      answer = !list.length ? say('आपके दस्तावेज़ों में कोई लोन नहीं मिला।', 'I don’t have any loan in your documents.')
        : say(list.map((l) => `${loanHi(l.loan)} (${l.lender}): ${l.outstanding} बाकी, ${l.emis_left} EMI बची हैं (EMI ${l.emi}), ${d(l.ends)} ${l.ends.slice(0, 4)} तक`).join('। ') + '।',
          list.map((l) => `Your ${l.loan} with ${l.lender}: ${l.outstanding} still to pay, ${l.emis_left} EMIs left at ${l.emi}, ending ${d(l.ends)} ${l.ends.slice(0, 4)}`).join('. ') + '.');
      break;
    }
    case 'overview': {
      const o = await call('money_overview');
      const m = ((o.months ?? []) as { month: string; complete: boolean; income: string; true_spend: string; committed: string; surplus: string; savings_rate: string }[]).filter((x) => x.complete).at(-1);
      answer = !m ? say('अभी कोई पूरा महीना नहीं है; एक पूरे महीने का स्टेटमेंट जोड़ें।', 'There’s no complete month yet; add a full month’s statement.')
        : say(`${m.month} में आमदनी ${m.income}, खर्च ${m.true_spend}, EMI-SIP-बीमा ${m.committed}। बचत ${m.surplus} रही, यानी ${m.savings_rate}।`,
          `In ${m.month} you earned ${m.income}, spent ${m.true_spend} and put ${m.committed} into EMIs, SIPs and insurance, so you saved ${m.surplus}, ${m.savings_rate} of income.`);
      break;
    }
    case 'claim': {
      const member = /papa|father|पापा|पिता/i.test(text) ? 'father' : /mummy|mother|maa|मम्मी|माँ/i.test(text) ? 'mother' : 'self';
      const condition = text;
      const r = await call('claim_helper', { member, condition, admission: /emergency|accident|इमरजेंसी|अचानक/i.test(text) ? 'emergency' : 'planned' });
      if (r.error) { answer = r.error; break; }
      answer = r.covered_now === 'no'
        ? say(`ध्यान दें: ${r.waiting_ends ? `इस बीमारी पर वेटिंग पीरियड ${d(r.waiting_ends)} ${r.waiting_ends.slice(0, 4)} को खत्म होगा, तब तक क्लेम पास नहीं होगा।` : r.member_insured ? r.reasons.join(' ') : 'यह सदस्य पॉलिसी में नहीं है।'} रूम रेंट की सीमा ${r.room_rent_cap_per_day} प्रति दिन है। क्या मैं TPA को सूचना वाला ईमेल ड्राफ़्ट करूँ?`, `Heads up: ${r.reasons.join(' ')} The room-rent cap is ${r.room_rent_cap_per_day} a day. Shall I draft the intimation to the TPA anyway?`)
        : say(`${r.member === 'father' ? 'पापा' : r.member === 'mother' ? 'मम्मी' : 'आप'} पॉलिसी में कवर हैं। ${r.intimate_within_hours} घंटे के अंदर ${r.tpa} को बताना होगा, हेल्पलाइन ${r.helpline}। रूम रेंट सीमा ${r.room_rent_cap_per_day} प्रति दिन, को-पे ${r.copay}। क्या मैं क्लेम सूचना ईमेल ड्राफ़्ट करूँ?`, `${r.member === 'self' ? 'You are' : `Your ${r.member} is`} covered. Inform ${r.tpa} within ${r.intimate_within_hours} hours on ${r.helpline}. Room-rent cap ${r.room_rent_cap_per_day} a day, co-pay ${r.copay}. Shall I draft the claim intimation?`);
      next = { tool: 'draft_email', input: { kind: 'claim_intimation', member, condition, admission: r.intimate_within_hours === 24 ? 'emergency' : 'planned' } };
      break;
    }
    case 'insurance': {
      const r = await call('insurance_overview');
      const endow = (r.policies ?? []).find((p: any) => p.projected_return_from_insurer_illustration); // eslint-disable-line @typescript-eslint/no-explicit-any
      answer = say(
        `बीमा पर साल में ${r.total_premium_per_year} जाते हैं, आमदनी का ${r.premium_share_of_income}। टर्म कवर ${r.term_cover} है, यानी सालाना आमदनी का ${r.term_cover_times_annual_income} गुना।${endow ? ` ${endow.insurer} की पॉलिसी पर ${endow.premium_per_year} सालाना जाता है; उसकी अपनी इलस्ट्रेशन के हिसाब से सालाना रिटर्न ${irrRange(endow.projected_return_from_insurer_illustration, true)} बनता है।` : ''}`,
        `You pay ${r.total_premium_per_year} a year on insurance, ${r.premium_share_of_income} of income. Term cover is ${r.term_cover}, ${r.term_cover_times_annual_income} times annual income.${endow ? ` The ${endow.insurer} plan costs ${endow.premium_per_year} a year; by its own illustration that works out to ${irrRange(endow.projected_return_from_insurer_illustration)} a year.` : ''}`);
      break;
    }
    case 'credit': {
      const r = await call('credit_health');
      if (r.error) { answer = r.error; break; }
      answer = say(
        `क्रेडिट स्कोर ${r.score} है, पहले ${r.previous_score} था। कारण: कार्ड यूटिलाइज़ेशन ${r.utilisation_previous} से बढ़कर ${r.utilisation_on_report} हुआ और ${r.enquiries_last_90_days.length} नई इंक्वायरी हुईं। अगला कार्ड बिल स्टेटमेंट डेट से पहले भर दें। क्या मैं रिमाइंडर लगा दूँ?`,
        `Your credit score is ${r.score}, down from ${r.previous_score}. Card utilisation went from ${r.utilisation_previous} to ${r.utilisation_on_report}, plus ${r.enquiries_last_90_days.length} new enquiries. Paying the card before the statement date lowers what's reported. Shall I set a reminder?`);
      const nextStmt = r.latest_statement_date ? prevDay(addMonths(r.latest_statement_date, 1)) : null;
      if (nextStmt) next = { tool: 'create_reminder', input: { title: say('कार्ड बिल स्टेटमेंट डेट से पहले भरें', 'Pay card before statement date'), date: nextStmt } };
      break;
    }
    case 'portfolio': {
      const r = await call('portfolio_xray');
      if (r.error) { answer = say('अभी आपका म्यूचुअल फ़ंड स्टेटमेंट (CAS) नहीं जुड़ा है।', 'Your mutual fund statement (CAS) is not added yet.'); break; }
      const t = r.tax_free_gains, pl = t.plan, g = r.regular_plans; // pl is null outside demo/internal/advised (no named-fund plan)
      const funds = pl ? (pl.funds as string[]).join(', ') : '';
      if (/direct|regular|switch|commission|fee|डायरेक्ट|रेगुलर|फ़ीस|फीस/i.test(text)) {
        answer = pl
          ? say(`रेगुलर प्लान पर करीब ${g.extra_fees_per_year_estimate} सालाना ज़्यादा फ़ीस जा रही है। एक साल से पुराने ${pl.move_to_direct_value} के यूनिट उसी फ़ंड के डायरेक्ट प्लान में ले जाने पर ${pl.gains_booked} का फ़ायदा टैक्स-फ़्री सीमा में बुक होगा, यानी अभी कोई टैक्स नहीं, और हर साल करीब ${pl.fees_saved_per_year} बचेंगे (${funds})। एक साल से नए यूनिट पर 20% टैक्स और एग्ज़िट लोड लग सकता है, उन्हें अभी रहने दें।`,
            `Regular plans cost you about ${g.extra_fees_per_year_estimate} a year in extra fees. Moving ${pl.move_to_direct_value} of units older than a year to the direct plan of the same funds (${funds}) books ${pl.gains_booked} of gains inside the tax-free limit, so no tax now, and saves about ${pl.fees_saved_per_year} a year. Units under a year old would be taxed at 20% and may carry an exit load, so leave those for now.`)
          : say(`रेगुलर प्लान पर करीब ${g.extra_fees_per_year_estimate} सालाना ज़्यादा फ़ीस जा रही है। उसी फ़ंड का डायरेक्ट प्लान सस्ता होता है। बदलने का मतलब है बेचना और फिर खरीदना: एक साल से नए यूनिट पर 20% टैक्स और एग्ज़िट लोड लग सकता है, और इस साल ${t.limit_left_this_year} तक का लंबी अवधि का फ़ायदा टैक्स-फ़्री है। फ़ैसला इन बातों को देखकर या किसी SEBI-रजिस्टर्ड सलाहकार के साथ लें।`,
            `Regular plans cost you about ${g.extra_fees_per_year_estimate} a year in extra fees; the direct plan of the same fund costs less. Switching means selling and buying again: units under a year old would be taxed at 20% and may carry an exit load, and up to ${t.limit_left_this_year} of long-term gains is tax-free this year. Weigh these facts, or decide with a SEBI-registered adviser.`);
      } else if (pl && /should|what (do|to)|kya kar|क्या कर|सलाह|advice|suggest/i.test(text)) {
        // test mode (named plan allowed): one decisive plan, numbers straight from the tool
        answer = say(`दो काम कीजिए। पहला, 31 मार्च से पहले ${funds} के एक साल से पुराने ${pl.move_to_direct_value} के यूनिट उसी फ़ंड के डायरेक्ट प्लान में ले जाइए: ${pl.gains_booked} का फ़ायदा टैक्स-फ़्री बुक होगा और हर साल करीब ${pl.fees_saved_per_year} फ़ीस बचेगी। दूसरा, हर महीने रेगुलर प्लान में जा रही ${g.sip_into_regular_per_month} की SIP उसी फ़ंड के डायरेक्ट प्लान में भेजिए।`,
          `Do two things. First, before 31 March, move ${pl.move_to_direct_value} of units older than a year in ${funds} to the direct plan of the same funds: that books ${pl.gains_booked} of gains tax-free and saves about ${pl.fees_saved_per_year} a year in fees. Second, send the ${g.sip_into_regular_per_month} a month that goes into regular plans to the direct plan of the same funds instead.`);
      } else if (/\bfd\b|fixed deposit|beat|better than|एफडी|एफ़डी/i.test(text)) {
        answer = say(`आपके पैसे ने साल का ${r.your_return_per_year_pct}% कमाया। उन्हीं तारीख़ों पर 7% की FD में डालते तो आज ${r.more_than_7pct_fd_before_tax} कम होते (टैक्स से पहले)।`,
          `Your money earned ${r.your_return_per_year_pct}% a year. The same amounts in a 7% FD on the same dates would be worth ${r.more_than_7pct_fd_before_tax} less today, before tax.`);
      } else if (/tax|harvest|book|ltcg|टैक्स/i.test(text)) {
        answer = pl
          ? say(`इस साल ${t.limit_left_this_year} तक का लंबी अवधि का फ़ायदा टैक्स-फ़्री है, ${t.days_left} दिन बाकी (31 मार्च)। अभी बुक करने से बाद में ${t.future_tax_saved_if_booked} टैक्स कम लगेगा। सबसे आसान तरीका: ${funds} के पुराने यूनिट उसी फ़ंड के डायरेक्ट प्लान में ले जाइए।`,
            `You can book up to ${t.limit_left_this_year} of long-term gains tax-free this year, with ${t.days_left} days left (31 March). Booking now means ${t.future_tax_saved_if_booked} less tax later. The simplest way: move older units of ${funds} to the direct plan of the same funds.`)
          : say(`इस साल ${t.limit_left_this_year} तक का लंबी अवधि का फ़ायदा टैक्स-फ़्री है (31 मार्च तक, ${t.days_left} दिन बाकी), और आपके पास ${t.long_term_gains_available} का लंबी अवधि का फ़ायदा है।`,
            `Up to ${t.limit_left_this_year} of long-term gains is tax-free this financial year (until 31 March, ${t.days_left} days left), and you hold ${t.long_term_gains_available} of long-term gains.`);
      } else {
        answer = say(`आपके ${r.value} ने साल का ${r.your_return_per_year_pct}% कमाया, 7% FD से ${r.more_than_7pct_fd_before_tax} ज़्यादा। 31 मार्च से पहले ${t.limit_left_this_year} तक का फ़ायदा टैक्स-फ़्री बुक कर सकते हैं। रेगुलर प्लान की फ़ीस करीब ${g.extra_fees_per_year_estimate} सालाना है।`,
          `Your ${r.value} earned ${r.your_return_per_year_pct}% a year, ${r.more_than_7pct_fd_before_tax} more than a 7% FD. You can book up to ${t.limit_left_this_year} of gains tax-free before 31 March. Regular-plan fees cost about ${g.extra_fees_per_year_estimate} a year.`);
      }
      break;
    }
    case 'invest': {
      const r = await call('emergency_fund');
      const full = Number(r.months_covered) >= Number(r.target_months);
      answer = full
        ? say('सेफ़्टी नेट पूरा है। अब लक्ष्य के हिसाब से लगाइए: 3 साल से कम के लिए FD या लिक्विड फ़ंड, 3 से 7 साल के लिए हाइब्रिड या डेट फ़ंड, 7 साल से ज़्यादा के लिए SIP से इक्विटी फ़ंड।',
            'Your safety net is full. Now invest by goal: under 3 years, an FD or liquid fund; 3 to 7 years, hybrid or debt funds; 7 years or more, an equity SIP.')
        : say(`पहले सेफ़्टी नेट पूरा कीजिए: अभी ${r.months_covered} महीने का है, लक्ष्य ${r.target_months} महीने, ${r.gap} बाकी। तब तक हर महीने की बचत RD या लिक्विड फ़ंड में डालिए। उसके बाद 7 साल से लंबे लक्ष्य के लिए इक्विटी SIP, 3 से 7 साल के लिए हाइब्रिड या डेट फ़ंड।`,
            `Fill your safety net first: it covers ${r.months_covered} months against a ${r.target_months}-month target, ${r.gap} to go. Until then, put the monthly amount in a recurring deposit or liquid fund. After that, an equity SIP for goals 7+ years away, hybrid or debt funds for 3 to 7 years.`);
      break;
    }
    case 'emergency': {
      const r = await call('emergency_fund');
      answer = say(`आपका सेफ़्टी नेट ${r.have} है, यानी ${r.months_covered} महीने के ज़रूरी खर्च। लक्ष्य ${r.target_months} महीने (${r.target}) का है, ${r.gap} बाकी।`, `Your safety net is ${r.have}, about ${r.months_covered} months of essentials. The target is ${r.target_months} months (${r.target}), so ${r.gap} to go.`);
      break;
    }
    case 'remind': {
      const r = await call('upcoming_dues');
      const dues = (r.dues ?? []) as { what: string; amount: string; date: string; kind?: string }[];
      const kindWanted = /card|कार्ड/i.test(text) ? /card/i : /emi|loan|लोन/i.test(text) ? /emi/i : /premium|insurance|bima|बीमा|प्रीमियम/i.test(text) ? /premium/i : null;
      const named = dues.find((x) => x.what.toLowerCase().split(/[^a-z]+/).some((w) => w.length > 3 && text.toLowerCase().includes(w)));
      const askedDate = dayMonth(text, String(r.as_of ?? ''));
      if (!kindWanted && !named && askedDate) { // "remind me on 31 Oct" without saying what: ask, don't guess a bill
        answer = say(`${d(askedDate)} को किस बात का रिमाइंडर लगाऊँ?`, `What should I remind you about on ${d(askedDate)}?`);
        break;
      }
      const first = (kindWanted ? dues.find((x) => kindWanted.test(x.what)) : undefined) ?? named ?? dues[0];
      if (first) { const a = await call('create_reminder', { title: `${first.what} ${first.amount}`, date: prevDay(first.date) }); answer = say(`${first.what} के लिए ${d(a.date)} का रिमाइंडर लगा दिया।`, `Reminder set for ${first.what} on ${d(a.date)}.`); }
      else answer = say('कोई आने वाला भुगतान नहीं मिला।', 'No upcoming dues found.');
      break;
    }
    case 'goal': {
      const amount = parseAmountRupees(text) ?? 100000;
      const asOf = (await call('upcoming_dues', { days: 1 })).as_of as string;
      const fyEnd = `${Number(asOf.slice(0, 4)) + (Number(asOf.slice(5, 7)) >= 4 ? 1 : 0)}-03-31`; // end of the financial year
      const r = await call('create_savings_goal', { name: say('बचत लक्ष्य', 'Savings goal'), target_rupees: amount, by_date: fyEnd });
      answer = say(`लक्ष्य बना दिया: ${r.target}, ${d(r.by)} तक। हर महीने ${r.monthly_needed} चाहिए; अभी औसत बचत ${r.average_monthly_surplus} है।`, `Goal created: ${r.target} by ${d(r.by)}. You need ${r.monthly_needed} a month; your average surplus is ${r.average_monthly_surplus}.`);
      break;
    }
  }
  pendingBySid.set(ctx.sid, next);
  return { answer, lang: ctx.lang, trace, actions, check: checkNumbers(answer, results), engine: 'offline', ms: Date.now() - t0 };
}

type AdviceStep = { step: string; status: string; finding: string; recommendation: string; numbers: Record<string, string | number | null> };
/** Hindi wording for each advice step, filled only with numbers from the advice_plan result. */
function adviceHi(s: AdviceStep): string {
  const n = s.numbers;
  switch (s.step) {
    case 'cash_flow': return `पिछले ${n.months_checked} महीनों में औसत बचत ${n.average_monthly_surplus} रही; बड़े खर्च पहले से प्लान करें।`;
    case 'card_debt': return 'क्रेडिट कार्ड का पूरा बिल हर महीने भरें; कार्ड का ब्याज सबसे महंगा कर्ज़ है।';
    case 'high_interest_loans': return n.personal_prepay_allowed_from
      ? `पर्सनल लोन (${n.personal_rate_pct}%) में ${spokenDate(String(n.personal_prepay_allowed_from), 'hi')} से पहले प्रीपेमेंट नहीं हो सकता; तब तक ${n.personal_lender ?? 'लेंडर'} से ${n.offer_rate_pct ? `${n.offer_rate_pct}% ` : 'कम '}रेट माँगिए और बची रकम इमरजेंसी फ़ंड या ${n.best_prepay_now === 'car loan' ? 'कार लोन' : 'दूसरे लोन'} में डालिए।`
      : 'सबसे महंगा लोन पहले चुकाइए।';
    case 'emergency_fund': return `इमरजेंसी फ़ंड ${n.months_now} महीने का है; लक्ष्य ${n.target_months} महीने, यानी ${n.target_amount}।`;
    case 'health_cover': return 'माता-पिता 60 के करीब हैं; को-पे शुरू होने से पहले सुपर टॉप-अप या अलग सीनियर कवर देख लीजिए।';
    case 'life_cover': return `टर्म कवर आमदनी का ${n.times_income} गुना है; इसे ${n.rule_times} गुना की ओर बढ़ाने पर विचार करें।`;
    case 'savings_policies': return 'एंडोमेंट पॉलिसी पर फ़ैसले से पहले बीमा कंपनी से सरेंडर और पेड-अप वैल्यू पूछिए।';
    case 'invest_surplus': return 'बची रकम लक्ष्य के हिसाब से लगाइए: 3 साल से कम के लिए FD या लिक्विड फ़ंड, 3 से 7 साल के लिए हाइब्रिड या डेट फ़ंड, 7 साल से ज़्यादा के लिए SIP से इक्विटी फ़ंड।';
    default: return s.recommendation;
  }
}
function irrRange(xs: string[], hi = false): string {
  const n = xs.map((x) => x.match(/-?[\d.]+%/)?.[0]).filter(Boolean);
  return n.length > 1 ? `${n[0]} ${hi ? 'से' : 'to'} ${n[n.length - 1]}` : n[0] ?? '';
}
function hintToDraft(h: string): string {
  return h === 'cancel_and_refund' ? 'refund_request' : h === 'dispute' ? 'dispute_charge' : h === 'ask_waiver' ? 'fee_waiver' : 'cancel_subscription';
}
function merchantOf(what: string) { return what.split(/[: ]/)[0]; }
function lkHi(l: { what: string; per_year?: string; deadline?: string; amount?: string }) {
  return `${l.what}${l.deadline ? ` (आख़िरी तारीख ${spokenDate(l.deadline, 'hi')})` : ''}`;
}
const prevDay = (iso: string) => new Date(Date.parse(iso + 'T00:00:00Z') - 86400000).toISOString().slice(0, 10);
