import { describe, it, expect } from 'vitest';
import { CutInDetector } from '../ui/cutIn';

// level traces at ~60 frames a second; returns the ms at which it decided the user was talking, or null
const F = 1000 / 60;
function run(levelAt: (ms: number, i: number) => number, ms = 6000, opts = {}) {
  const d = new CutInDetector(opts);
  for (let i = 0; i * F < ms; i++) if (d.push(levelAt(i * F, i), 1000 + i * F)) return { at: Math.round(i * F), d };
  return { at: null, d };
}
const echo = (ms: number, i: number) => 0.06 + 0.04 * Math.sin(i / 3);            // Munim's leftover voice after cancellation
const speech = (ms: number, i: number) => (i % 7 === 0 ? 0.05 : 0.24 + 0.08 * Math.sin(i)); // syllables with a dip every ~120 ms

describe('cut-in detector (D-090)', () => {
  it('never fires on echo alone, even loud echo while cancellation settles', () => {
    expect(run((ms, i) => (ms < 1200 ? 0.3 : 0) + echo(ms, i)).at).toBeNull();
  });
  it('hears normal speech with dips between syllables (the old every-frame rule missed this)', () => {
    const r = run((ms, i) => echo(ms, i) + (ms > 3000 ? speech(ms, i) : 0));
    expect(r.at).not.toBeNull(); expect(r.at!).toBeGreaterThan(3000); expect(r.at!).toBeLessThan(3600);
    expect(r.d.startedAt - 1000).toBeGreaterThanOrEqual(3000 - F); // the recording keeps words from where they began
    expect(r.d.diag().triggered).toBe(true);
  });
  it('the bar comes down after a loud start, so later speech still gets through', () => {
    const r = run((ms, i) => (ms < 1000 ? 0.35 : 0.05) + (ms > 3500 ? speech(ms, i) : 0));
    expect(r.at).not.toBeNull();
  });
  it('ignores a short burst (a cough, a clatter)', () => {
    expect(run((ms, i) => echo(ms, i) + (ms > 2000 && ms < 2180 ? 0.5 : 0)).at).toBeNull();
  });
  it('reports what it saw when it did not fire', () => {
    const { d } = run((ms, i) => echo(ms, i) + (ms > 2000 ? 0.04 : 0), 4000);
    const g = d.diag();
    expect(g.triggered).toBe(false); expect(g.need).toBeGreaterThanOrEqual(0.15); expect(g.peak).toBeLessThan(g.need); expect(g.frames).toBeGreaterThan(200);
  });
});
