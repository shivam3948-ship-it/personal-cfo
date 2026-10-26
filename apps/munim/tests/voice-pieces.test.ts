// Piece-by-piece speech (D-058): the next piece is fetched while the current one plays, a failed voice service falls
// back to the browser for the rest, and Stop ends the whole answer.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { speakPieces, stopSpeaking, type Audio64 } from '@/ui/voice';

let log: string[] = [];
const PLAY_MS = 30;
class FakeAudio {
  onplaying: (() => void) | null = null; onended: (() => void) | null = null; onerror: (() => void) | null = null; volume = 1;
  constructor(public src: string) {}
  play() { log.push(`play:${atob(this.src.split(',')[1])}`); setTimeout(() => this.onplaying?.(), 1); setTimeout(() => { log.push(`end:${atob(this.src.split(',')[1])}`); this.onended?.(); }, PLAY_MS); return Promise.resolve(); }
  pause() { log.push('pause'); }
}
const audio = (p: string): Audio64 => ({ audioBase64: btoa(p), mime: 'audio/mpeg' });

beforeEach(() => { log = []; vi.stubGlobal('Audio', FakeAudio); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('speakPieces', () => {
  it('fetches piece 2 while piece 1 is playing, and times the first sound', async () => {
    const tts = vi.fn(async (p: string) => { log.push(`tts:${p}`); await new Promise((r) => setTimeout(r, 10)); return audio(p); });
    const run = await speakPieces(['one', 'two', 'three'], 'en', tts, (p) => p);
    expect(run).toMatchObject({ pieces: 3, voice: 'sarvam', stopped: false });
    expect(run.firstMs).toBeGreaterThanOrEqual(10);
    expect(log.indexOf('tts:two')).toBeLessThan(log.indexOf('end:one'));
    expect(log.indexOf('tts:three')).toBeLessThan(log.indexOf('end:two'));
    expect(log.filter((l) => l.startsWith('play:'))).toEqual(['play:one', 'play:two', 'play:three']);
  });

  it('falls back to the browser voice for the rest when the voice service fails', async () => {
    const tts = vi.fn(async () => null);
    const said: string[] = [];
    const run = await speakPieces(['एक।', 'दो।'], 'hi', tts, (p) => { said.push(p); return p; });
    expect(run.voice).toBe('browser'); expect(tts).toHaveBeenCalledTimes(1); expect(said).toEqual(['एक।', 'दो।']);
  });

  it('Stop ends the whole answer and nothing more is fetched', async () => {
    const tts = vi.fn(async (p: string) => audio(p));
    const pending = speakPieces(['one', 'two', 'three'], 'en', tts, (p) => p);
    await new Promise((r) => setTimeout(r, 5)); stopSpeaking();
    const run = await pending;
    expect(run.stopped).toBe(true);
    expect(log).not.toContain('play:three'); expect(tts.mock.calls.length).toBeLessThanOrEqual(2);
  });
});
