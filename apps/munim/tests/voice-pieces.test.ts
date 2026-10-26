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

class FakeUtterance { onstart: (() => void) | null = null; onend: (() => void) | null = null; onerror: (() => void) | null = null; lang = ''; rate = 1; voice: unknown = null; constructor(public text: string) {} }
const fakeSynth = { getVoices: () => [], cancel: () => {}, speak: (u: FakeUtterance) => { log.push(`say:${u.text}`); setTimeout(() => u.onstart?.(), 1); setTimeout(() => u.onend?.(), 5); } };
beforeEach(() => { log = []; vi.stubGlobal('Audio', FakeAudio); vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance); vi.stubGlobal('speechSynthesis', fakeSynth); });
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

  it('a clip that fails to play is read by the browser voice, not skipped', async () => {
    class Broken extends FakeAudio { play() { setTimeout(() => this.onerror?.(), 1); return Promise.resolve(); } }
    vi.stubGlobal('Audio', Broken);
    const said: string[] = [];
    const run = await speakPieces(['one.', 'For education only, not investment advice.'], 'en', async (p) => audio(p), (p) => { said.push(p); return p; });
    expect(said).toEqual(['one.', 'For education only, not investment advice.']); expect(run.voice).toBe('browser'); expect(log.filter((l) => l.startsWith('say:'))).toHaveLength(2);
  });

  it('with no voice at all, no first-word time is reported', async () => {
    vi.stubGlobal('speechSynthesis', undefined);
    const run = await speakPieces(['one.'], 'en', async () => null, (p) => p);
    expect(run).toMatchObject({ voice: 'none', firstMs: null });
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
