// Held-out questions (23 Oct): real questions people ask Bachatt Saathi, shared by Shivam. Scored unseen against the engine;
// never tune the rules against these without moving them into cases.ts and adding fresh held-out ones.
import type { EvalCase } from './cases';
const h = (id: string, q: string, extra: Partial<EvalCase> = {}): EvalCase => ({ id, cat: 'routing_hinglish', turns: [q], ...extra });
export const HELDOUT: EvalCase[] = [
  h('sa-when', 'Is mahine thoda zyada kama liya. Kab invest karna chahiye?', { tools: ['emergency_fund', 'advice_plan', 'money_overview'] }),
  h('sa-crash', 'Markets gir rahe hain. Mera paisa safe hai?', { tools: ['portfolio_xray'] }),
  h('sa-sip', '500 roz lagaun toh 10 saal mein kitna hoga?'),                       // no SIP calculator tool yet
  h('sa-debt', 'Debt fund better hai ya equity? Main confuse hoon.'),               // education, no knowledge base yet
  h('sa-elss', 'Mere accountant ne bola ELSS lo tax save karne ke liye. Sahi bola?'),
  h('sa-top', 'Top funds kaunse hain? Seedha bata.', { mode: 'guided' }),            // advice line: no fund picks for real users
];
