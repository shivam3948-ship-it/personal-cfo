// Core data model. All money is integer paise (Number.isSafeInteger), never floats.
export type Paise = number;
export type Lang = 'hi' | 'en';

export type Source = 'bank_statement' | 'card_statement' | 'sms' | 'email' | 'manual';

export interface Txn {
  id: string;
  date: string; // YYYY-MM-DD
  desc: string;
  amount: Paise; // always positive
  dir: 'debit' | 'credit';
  balance?: Paise; // running balance after this row, when the source prints it
  account: string; // e.g. "bank:4521", "card:9012"
  source: Source;
  sourceFile: string;
  category?: string;
  merchant?: string;
}

export interface Account {
  id: string; // "bank:4521"
  kind: 'bank' | 'card';
  label: string;
  last4: string;
  opening?: Paise;
  closing?: Paise;
  closingDate?: string;
  limit?: Paise;
}

export interface CardStatement {
  account: string;
  file: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  prevBalance: Paise;
  payments: Paise;
  purchases: Paise;
  credits: Paise;
  charges: Paise;
  totalDue: Paise;
  minDue: Paise;
  limit?: Paise;
}

export interface Loan {
  id: string;
  lender: string;
  type: 'car' | 'personal' | 'home' | 'education' | 'other';
  last4: string;
  principal: Paise;
  ratePct: number; // annual, e.g. 9.5
  tenureMonths: number;
  emi: Paise;
  firstEmiDate: string;
  emiDay: number;
  prepay: { allowedAfterEmis: number; chargePct: number; gst: boolean };
  foreclose: { allowedAfterEmis: number; chargePct: number; gst: boolean };
  file: string;
}

export interface HealthTerms {
  members: { relation: string; age: number }[];
  roomRentPctPerDay?: number;
  icuPctPerDay?: number;
  copayPct?: number;
  copayAgeAbove?: number;
  initialWaitingDays?: number;
  specificWaitingMonths?: number;
  specificIllnesses: string[];
  pedWaitingMonths?: number;
  pedDeclared?: string;
  intimationPlannedHours?: number;
  intimationEmergencyHours?: number;
  reimbursementDays?: number;
  tpa?: string;
  helpline?: string;
  claimsEmail?: string;
  documents: string[];
  firstStartDate?: string;
}

export interface Policy {
  id: string;
  insurer: string;
  kind: 'term' | 'health' | 'endowment' | 'ulip' | 'other';
  name: string;
  last4: string;
  sumAssured: Paise;
  premium: Paise; // per payment
  premiumFreq: 'monthly' | 'quarterly' | 'yearly';
  startDate?: string;
  nextDue?: string;
  termYears?: number;
  illustrations?: { ratePct: number; value: Paise }[];
  nominee?: string;
  health?: HealthTerms;
  file: string;
}

export interface CreditReport {
  bureau: string;
  score: number;
  asOf: string;
  previousScore?: number;
  previousAsOf?: string;
  utilisationPct?: number;
  previousUtilisationPct?: number;
  accounts: { type: string; lender: string; amount?: Paise; balance?: Paise; status: string; dpd: string }[];
  enquiries: { date: string; lender: string; purpose: string }[];
  factors: string[];
  file: string;
}

export interface LoanOffer {
  lender: string;
  ratePct: number;
  maxAmount?: Paise;
  maxTenureMonths?: number;
  processingFeePct?: number;
  gstOnFee: boolean;
  validTill?: string;
  file: string;
}

export interface Notice {
  id: string;
  date: string;
  from: string;
  subject: string;
  kind: 'price_change' | 'inactivity' | 'emi_due' | 'renewal' | 'offer' | 'trial_charge' | 'statement' | 'other';
  text: string;
  file: string;
  data: Record<string, string | number>;
}

export interface Check {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
}

export interface DocText {
  id: string;
  file: string;
  kind: string;
  text: string;
}

export interface IngestResult {
  file: string;
  kind: string;
  parser: 'rule' | 'llm' | 'none';
  ok: boolean;
  summary: string;
  checks: Check[];
}

import type { CasCheck, Holding } from './portfolio/cas';
export interface PortfolioData { asOf: string; holdings: Holding[]; checks: CasCheck[]; source: string }

export interface Dataset {
  accounts: Account[];
  txns: Txn[];
  cardStatements: CardStatement[];
  loans: Loan[];
  policies: Policy[];
  credit?: CreditReport;
  offers: LoanOffer[];
  notices: Notice[];
  /** Your answers to "Still using it?", kept on the phone (D-052): merchant → answer and when. */
  subAnswers?: Record<string, { answer: 'yes' | 'no' | 'later'; at: string }>;
  docs: DocText[];
  log: IngestResult[];
  label: string; // "Sample data" or "Your uploads"
  portfolio?: PortfolioData; // mutual funds from a CAS, parsed on the device
}

export const emptyDataset = (label = 'Your uploads'): Dataset => ({
  accounts: [], txns: [], cardStatements: [], loans: [], policies: [], offers: [], notices: [], docs: [], log: [], label,
});
