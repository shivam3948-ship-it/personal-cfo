// Who is asking and whose money. v2 starts with the sample family only; sign-in and real uploads plug in here last
// (D-031) without any screen changing: screens only ever see a Session.
import type { Dataset } from '@core/types';
import { loadDemo } from '@core/demo';

// Advice mode is resolved on the server only (D-021). demo = synthetic sample family; guided = invite-only real users, category level.
export type AdviceMode = 'off' | 'guided' | 'internal' | 'demo' | 'advised';
/** Modes allowed to name the user's own funds with an amount or a date (docs/12 ladder rung 3). */
export const namesFunds = (m: AdviceMode) => m === 'demo' || m === 'internal' || m === 'advised';
/** One disclaimer per mode, shown under every Ask answer and given once in the conversation. Test builds say so plainly. */
export const DISCLAIMER: Record<AdviceMode, { en: string; hi: string }> = {
  demo: { en: 'Test build on sample data. For testing only, not investment advice.', hi: 'टेस्ट वर्ज़न, सैंपल डेटा पर। सिर्फ़ टेस्टिंग के लिए, निवेश सलाह नहीं।' },
  internal: { en: 'Test build. For testing only, not investment advice.', hi: 'टेस्ट वर्ज़न। सिर्फ़ टेस्टिंग के लिए, निवेश सलाह नहीं।' },
  guided: { en: 'General guidance, not SEBI-registered investment advice.', hi: 'सामान्य जानकारी, SEBI-रजिस्टर्ड निवेश सलाह नहीं।' },
  advised: { en: 'Investment advice from a SEBI-registered adviser.', hi: 'SEBI-रजिस्टर्ड सलाहकार की निवेश सलाह।' },
  off: { en: 'Information only, not investment advice.', hi: 'सिर्फ़ जानकारी, निवेश सलाह नहीं।' },
};

export interface Session {
  id: string;
  kind: 'sample' | 'user';
  memberLabel: string;      // "Me", "Papa"
  displayName: string | null; // shown in the greeting; never sent to an LLM
  adviceMode: AdviceMode;
  dataset(): Promise<Dataset>;
}

// Testing switch: MUNIM_ADVICE_MODE=guided in .env.local previews what real (invited) users will see. Only demo/guided are
// accepted, and the sample family is always synthetic data. Real users will get their mode from the server, never from this.
const envMode = process.env.MUNIM_ADVICE_MODE === 'guided' ? 'guided' : 'demo';
const sample: Session = { id: 'sample', kind: 'sample', memberLabel: 'Me', displayName: 'Rohan', adviceMode: envMode, dataset: loadDemo };

export async function getSession(_req: Request): Promise<Session> {
  return sample;
}
