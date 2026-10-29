// Choosing the sample family keeps it on screen even when the phone also holds your statements; adding your own data
// switches back to it.
import { describe, expect, it } from 'vitest';
import { getProfile, saveProfile, switchToMyData } from '@/lib/local/profile';

describe('sample mode', () => {
  it('switchToMyData leaves the sample family, and does nothing without a profile or on your own data', () => {
    saveProfile({ lang: 'hi', start: 'sample', name: null, doneAt: '2026-10-27T00:00:00Z' });
    switchToMyData();
    expect(getProfile()).toMatchObject({ start: 'mine', lang: 'hi' });
    switchToMyData();
    expect(getProfile()?.start).toBe('mine');
  });
});
