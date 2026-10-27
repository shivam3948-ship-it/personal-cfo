// Choosing the sample family keeps it on screen even when the phone also holds your statements; adding your own data
// switches back to it.
import { describe, expect, it } from 'vitest';
import { getProfile, saveProfile, switchToMyData } from '@/lib/local/profile';
import { readSmsText } from '@/lib/local/sms';

describe('sample mode', () => {
  it('switchToMyData leaves the sample family, and does nothing without a profile or on your own data', () => {
    saveProfile({ lang: 'hi', start: 'sample', name: null, doneAt: '2026-10-27T00:00:00Z' });
    switchToMyData();
    expect(getProfile()).toMatchObject({ start: 'mine', lang: 'hi' });
    switchToMyData();
    expect(getProfile()?.start).toBe('mine');
  });
  it('adding bank SMS while on the sample family switches to your data', async () => {
    saveProfile({ lang: 'en', start: 'sample', name: null, doneAt: '2026-10-27T00:00:00Z' });
    const r = await readSmsText('Sent Rs.250.00 From HDFC Bank A/C *4521 To ASHA KIRANA On 02/10/26 Ref 1 Not You?', 'pasted SMS');
    expect(r.added).toBe(1);
    expect(getProfile()?.start).toBe('mine');
  });
});
