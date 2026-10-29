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
