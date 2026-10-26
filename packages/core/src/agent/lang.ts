import type { Lang } from '../types';
import { groupIndian } from '../money';
import { spokenDate } from '../dates';

const HINGLISH = /\b(mera|meri|mere|kya|kitna|kitne|kitni|kab|kaise|kahan|kaha|paisa|paise|kharcha|kharch|bachat|haan|nahi|karo|kar do|batao|bataiye|chahiye|hai|hain|hoon|mujhe|maine|kyun|aur|loan jaldi|chuka)\b/i;

export function detectLang(text: string, hint?: Lang | 'auto'): Lang {
  if (hint === 'hi' || hint === 'en') return hint;
  if (/[ऀ-ॿ]/.test(text)) return 'hi';
  return HINGLISH.test(text) ? 'hi' : 'en';
}

/** "50 hazaar", "1.5 lakh", "₹40,000", "५० हज़ार", "50k" -> rupees. */
export function parseAmountRupees(text: string): number | null {
  const t = text.replace(/[०-९]/g, (d) => String('०१२३४५६७८९'.indexOf(d))).toLowerCase();
  const m = t.match(/(\d+(?:[.,]\d+)*)\s*(lakh|lac|लाख|crore|cr\b|करोड़|hazaar|hazar|हज़ार|हजार|thousand|k\b)?/i);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ''));
  if (!Number.isFinite(n)) return null;
  const u = (m[2] ?? '').toLowerCase();
  if (/lakh|lac|लाख/.test(u)) return Math.round(n * 1e5);
  if (/crore|cr|करोड़/.test(u)) return Math.round(n * 1e7);
  if (/hazaar|hazar|हज़ार|हजार|thousand|k/.test(u)) return Math.round(n * 1e3);
  return n >= 100 ? Math.round(n) : null;
}

/** An answer cut into pieces for voice, so the first sentence can play while the rest is turned into speech (D-058).
 *  Splits after . ? ! । followed by a space (so 1.5 and ₹1,25,000.50 stay whole, and Rs. / e.g. / vs. / No. don't end a
 *  sentence). The first piece is one sentence (merged with the next if it's under `minFirst` characters); later pieces
 *  gather sentences up to `max` characters. Joining the pieces with spaces gives back the text, whitespace aside. */
export function splitForSpeech(text: string, opts: { minFirst?: number; max?: number } = {}): string[] {
  const minFirst = opts.minFirst ?? 25, max = opts.max ?? 320;
  const raw = text.replace(/\s+/g, ' ').trim();
  if (!raw) return [];
  const parts = raw.split(/(?<=[.?!।])\s+/);
  const sentences: string[] = [];
  for (const p of parts) {
    const prev = sentences.at(-1);
    if (prev && /(?:^|\s)(?:rs|e\.g|i\.e|vs|no|approx|mr|mrs|dr)\.$/i.test(prev)) sentences[sentences.length - 1] = `${prev} ${p}`;
    else sentences.push(p);
  }
  const out: string[] = [];
  let i = 0, first = sentences[i++];
  while (first.length < minFirst && i < sentences.length) first = `${first} ${sentences[i++]}`;
  out.push(first);
  let cur = '';
  for (; i < sentences.length; i++) {
    const s = sentences[i];
    if (cur && cur.length + 1 + s.length > max) { out.push(cur); cur = s; } else cur = cur ? `${cur} ${s}` : s;
  }
  if (cur) out.push(cur);
  return out;
}

/** Make text TTS-friendly: rupee symbol, ISO dates, percentages, stray markdown. */
export function forSpeech(text: string, lang: Lang): string {
  let s = text.replace(/[*_#`>|]/g, '').replace(/\s*\n+\s*/g, ' ');
  s = s.replace(/(\d{4})-(\d{2})-(\d{2})/g, (d) => spokenDate(d, lang));
  s = s.replace(/₹\s?([\d,]+(?:\.\d+)?)(\s*(?:lakh|लाख|crore|करोड़))?/gi, (_, n: string, unit?: string) => `${normaliseNum(n)}${unit ?? ''} ${lang === 'hi' ? 'रुपये' : 'rupees'}`);
  s = s.replace(/(\d+(?:\.\d+)?)\s?%/g, (_, n) => `${n} ${lang === 'hi' ? 'प्रतिशत' : 'percent'}`);
  return s.replace(/\s{2,}/g, ' ').trim();
}
const normaliseNum = (n: string) => { const v = Number(n.replace(/,/g, '')); return Number.isInteger(v) ? groupIndian(v) : n; };
