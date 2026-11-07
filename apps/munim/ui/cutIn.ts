// Deciding that the user has started talking over Munim (D-090). Pure: fed one microphone level (0..1) per animation
// frame, so tests can replay a level trace. Replaces the D-082 rule after "it kept talking" on a MacBook Air in Chrome
// (7 Nov), where the old rule had two faults:
//   1. It needed every single frame (~20 ms) above the bar for 0.3 s. Speech dips between syllables, so one quiet frame
//      reset the count and normal talking rarely got through. Now: most frames (60%) in the last 0.4 s, for 0.25 s.
//   2. It learned how loud Munim's own leftover voice is from the first 0.6 s only, while echo cancellation is still
//      settling and the leftover is at its loudest, so the bar stayed high all answer. Now: the bar follows the typical
//      (median) level of the last 1.5 s, so it drops once cancellation settles, and a short burst of speech can't lift it.
// Every number it used is reported (diag), so a missed or false cut-in can be explained from the owner's log.

export interface CutInOpts { min?: number; cap?: number; k?: number; warmMs?: number; floorMs?: number; winMs?: number; frac?: number; holdMs?: number }
export interface CutInDiag {
  frames: number; ms: number;          // how long it listened
  floor: number; need: number;          // Munim's leftover voice (median of the last 1.5 s) and the bar it set, at the end or at the cut-in
  peak: number; p90: number;            // the loudest frame and the 90th percentile while it listened
  triggered: boolean; atMs?: number;    // cut in, and when (from the start of listening)
}

const r3 = (x: number) => Math.round(x * 1000) / 1000;

export class CutInDetector {
  private o: Required<CutInOpts>;
  private t0 = -1; private hist: { at: number; v: number }[] = []; private win: { at: number; over: boolean }[] = [];
  private firstOver = 0; private all: number[] = []; private done = false; private atMs?: number; private lastNeed: number; private lastFloor = 0;
  /** When the current run of speech began (performance.now() time): the recording keeps audio from just before it. */
  startedAt = 0;

  constructor(opts: CutInOpts = {}) {
    // min 0.15 (was a fixed 0.3): the cancellation turns the user's voice down while Munim talks, so the old bar was too high
    this.o = { min: 0.15, cap: 0.45, k: 2.5, warmMs: 400, floorMs: 1500, winMs: 400, frac: 0.6, holdMs: 250, ...opts };
    this.lastNeed = this.o.min;
  }

  private median(): number {
    if (!this.hist.length) return 0;
    const s = this.hist.map((h) => h.v).sort((a, b) => a - b); return s[Math.floor(s.length / 2)];
  }

  /** One level reading. True once, at the frame it decides the user is talking. */
  push(level: number, now: number): boolean {
    if (this.done) return false;
    if (this.t0 < 0) this.t0 = now;
    this.all.push(level);
    const floor = this.median(); // from frames before this one: a sudden loud frame can't raise its own bar
    const need = Math.min(this.o.cap, Math.max(this.o.min, floor * this.o.k));
    this.lastFloor = floor; this.lastNeed = need;
    this.hist.push({ at: now, v: level }); while (this.hist.length && now - this.hist[0].at > this.o.floorMs) this.hist.shift();
    if (now - this.t0 < this.o.warmMs) return false; // learning only: the first moments of an answer are the loudest echo
    const over = level > need;
    this.win.push({ at: now, over }); while (this.win.length && now - this.win[0].at > this.o.winMs) this.win.shift();
    if (over && !this.firstOver) this.firstOver = now;
    const share = this.win.filter((w) => w.over).length / this.win.length;
    if (!this.win.some((w) => w.over)) this.firstOver = 0; // nothing loud for a whole window: the run is over
    if (this.firstOver && now - this.firstOver >= this.o.holdMs && share >= this.o.frac) {
      this.done = true; this.atMs = Math.round(now - this.t0); this.startedAt = this.firstOver; return true;
    }
    return false;
  }

  diag(now?: number): CutInDiag {
    const s = [...this.all].sort((a, b) => a - b);
    const ms = this.t0 < 0 ? 0 : Math.round((now ?? (this.t0 + 0)) - this.t0);
    return { frames: this.all.length, ms: this.atMs ?? Math.max(0, ms), floor: r3(this.lastFloor), need: r3(this.lastNeed), peak: r3(s.at(-1) ?? 0),
      p90: r3(s[Math.floor(s.length * 0.9)] ?? 0), triggered: this.done, ...(this.atMs !== undefined ? { atMs: this.atMs } : {}) };
  }
}
