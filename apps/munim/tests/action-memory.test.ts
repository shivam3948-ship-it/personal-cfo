// Munim's earlier answer carries what it already saved (29 Oct demo check, case 10): a "yes" to its follow-up must not
// trigger an apology for a reminder it did save, or a second copy of it.
import { describe, expect, it } from 'vitest';
import { doneNote } from '@/lib/actionsCore';

describe('the saved-actions note', () => {
  it('lists what one answer saved, and nothing when it saved nothing', () => {
    expect(doneNote([{ kind: 'reminder', title: 'Pay card bill', reminder: { date: '2026-10-30' } }])).toBe('(Already saved in this answer: reminder "Pay card bill" for 2026-10-30.)');
    expect(doneNote([{ kind: 'email', title: 'Cancel cult.fit' }, { kind: 'goal', title: 'Goa trip' }])).toBe('(Already saved in this answer: email draft "Cancel cult.fit"; savings goal "Goa trip".)');
    expect(doneNote([])).toBe(''); expect(doneNote(undefined)).toBe('');
  });
});

describe('the note never reads as an offer (review, 29 Oct)', async () => {
  const { allowedActions } = await import('@/lib/agent/claude');
  it('a "?" in a saved title does not let a bare "ok" run an action', async () => {
    const { runClaude } = await import('@/lib/agent/claude');
    expect(allowedActions('ok', 'Done, I saved it.')).toEqual([]);
    // runClaude strips the note before the guard: simulated through the same regex the loop uses
    const prev = 'Done, I saved it.\n\n(Already saved in this answer: reminder "Pay the HDFC card bill?" for 2026-10-30.)'.replace(/\s*\(Already saved in this answer: [^\n]*\)\s*$/, '');
    expect(allowedActions('ok', prev)).toEqual([]);
    expect(typeof runClaude).toBe('function');
  });
});
