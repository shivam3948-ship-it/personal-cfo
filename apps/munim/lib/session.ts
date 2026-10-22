// Who is asking and whose money. v2 starts with the sample family only; sign-in and real uploads plug in here last
// (D-031) without any screen changing: screens only ever see a Session.
import type { Dataset } from '@core/types';
import { loadDemo } from '@core/demo';

// Advice mode is resolved on the server only (D-021). demo = synthetic sample family; guided = invite-only real users, category level.
export type AdviceMode = 'off' | 'guided' | 'internal' | 'demo' | 'advised';
/** Modes allowed to name the user's own funds with an amount or a date (docs/12 ladder rung 3). */
export const namesFunds = (m: AdviceMode) => m === 'demo' || m === 'internal' || m === 'advised';

export interface Session {
  id: string;
  kind: 'sample' | 'user';
  memberLabel: string;      // "Me", "Papa"
  displayName: string | null; // shown in the greeting; never sent to an LLM
  adviceMode: AdviceMode;
  dataset(): Promise<Dataset>;
}

const sample: Session = { id: 'sample', kind: 'sample', memberLabel: 'Me', displayName: 'Rohan', adviceMode: 'demo', dataset: loadDemo };

export async function getSession(_req: Request): Promise<Session> {
  return sample;
}
