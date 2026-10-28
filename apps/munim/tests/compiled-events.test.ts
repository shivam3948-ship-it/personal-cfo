// The design compiler once turned onTouchEnd into "ontouchend", which React ignores: the check-in swipe started but never
// finished. Every event handler in a compiled screen must be camelCase (and tools/dc2react.py now refuses unknown ones).
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const dir = path.join(__dirname, '..', 'screens');
describe('compiled screens', () => {
  it.each(fs.readdirSync(dir).filter((f) => f.endsWith('.jsx')))('%s has no lowercase event attributes', (f) => {
    expect(fs.readFileSync(path.join(dir, f), 'utf8').match(/\son[a-z]+=\{/g) ?? []).toEqual([]);
  });
  it('the Today check-in card handles the whole touch swipe', () => {
    const src = fs.readFileSync(path.join(dir, 'Today.jsx'), 'utf8');
    expect(src).toContain('onTouchStart={V.touchStart}'); expect(src).toContain('onTouchEnd={V.touchEnd}');
  });
});
