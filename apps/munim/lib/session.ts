// Who is asking and whose money. v2 starts with the sample family only; sign-in and real uploads plug in here last
// (D-031) without any screen changing: screens only ever see a Session.
import type { Dataset } from '@core/types';
import { loadDemo } from '@core/demo';
import { adviceUnlocked } from './adviceUnlock';

import { type AdviceMode } from './advice';
export { DISCLAIMER, namesFunds, type AdviceMode } from './advice';

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

export async function getSession(req: Request): Promise<Session> {
  // Testing switch on the live link: ?mode=guided sets this cookie (ui/TestSwitches). It can only make advice STRICTER
  // (demo → guided), never looser, so a forged cookie gains nothing.
  const preview = /(?:^|;\s*)munim_mode=guided(?:;|$)/.test(req.headers.get('cookie') ?? '');
  // advice switched on by the owner for this browser (D-066) beats the preview and the default
  if (adviceUnlocked(req)) return { ...sample, adviceMode: 'private' };
  return preview ? { ...sample, adviceMode: 'guided' } : sample;
}
