// Held-out questions (23 Oct): real questions people ask Bachatt Saathi, shared by Shivam. Scored unseen against the engine;
// never tune the rules against these without moving them into cases.ts and adding fresh held-out ones.
// 23 Oct: all 15 below were seen and fixed against, so they moved to cases.ts. Kept here only as the record of the
// unseen score (evals/results/2026-10-23-heldout-saathi.md). The next held-out batch needs new questions.
import type { EvalCase } from './cases';
const h = (id: string, q: string, extra: Partial<EvalCase> = {}): EvalCase => ({ id, cat: 'routing_hinglish', turns: [q], ...extra });
export const HELDOUT: EvalCase[] = [
  h('sa-when', 'Is mahine thoda zyada kama liya. Kab invest karna chahiye?', { tools: ['emergency_fund', 'advice_plan', 'money_overview'] }),
  h('sa-crash', 'Markets gir rahe hain. Mera paisa safe hai?', { tools: ['portfolio_xray'] }),
  h('sa-sip', '500 roz lagaun toh 10 saal mein kitna hoga?'),                       // no SIP calculator tool yet
  h('sa-debt', 'Debt fund better hai ya equity? Main confuse hoon.'),               // education, no knowledge base yet
  h('sa-elss', 'Mere accountant ne bola ELSS lo tax save karne ke liye. Sahi bola?'),
  h('sa-top', 'Top funds kaunse hain? Seedha bata.', { mode: 'guided' }),            // advice line: no fund picks for real users

  // 23 Oct, batch 2 (Shivam): the open "audit" questions, asked about statements and about mutual funds
  h('au-miss', 'What am I missing?', { tools: ['advice_plan', 'sunday_briefing'] }),
  h('au-wrong', 'Where am I wrong?', { tools: ['advice_plan', 'sunday_briefing'] }),
  h('au-better', 'What can I do better?', { tools: ['advice_plan', 'sunday_briefing'] }),
  h('au-miss-sp', 'What am I missing in my bank and credit card spending?', { tools: ['subscriptions_and_leaks', 'unusual_spending', 'spending_breakdown', 'sunday_briefing'] }),
  h('au-wrong-sp', 'Where am I going wrong with my bank and credit card statements?', { tools: ['subscriptions_and_leaks', 'unusual_spending', 'spending_breakdown', 'sunday_briefing'] }),
  h('au-better-sp', 'What can I do better with my spending?', { tools: ['subscriptions_and_leaks', 'unusual_spending', 'spending_breakdown'] }),
  h('au-miss-mf', 'What am I missing in my mutual funds?', { tools: ['portfolio_xray'] }),
  h('au-wrong-mf', 'Where am I wrong with my mutual fund holdings?', { tools: ['portfolio_xray'] }),
  h('au-better-mf', 'What can I do better with my mutual funds?', { tools: ['portfolio_xray'] }),
];
