// Who is asking and whose money. v2 starts with the sample family only; sign-in and real uploads plug in here last
// (D-031) without any screen changing: screens only ever see a Session.
import type { Dataset } from '@core/types';
import { loadDemo } from '@core/demo';

export interface Session {
  id: string;
  kind: 'sample' | 'user';
  memberLabel: string;      // "Me", "Papa"
  displayName: string | null; // shown in the greeting; never sent to an LLM
  dataset(): Promise<Dataset>;
}

const sample: Session = { id: 'sample', kind: 'sample', memberLabel: 'Me', displayName: 'Rohan', dataset: loadDemo };

export async function getSession(_req: Request): Promise<Session> {
  return sample;
}
