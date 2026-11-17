import { describe, it, expect } from 'vitest';
import { nameOk } from '../lib/server/benchmarks';

// the first live check matched factor funds by name search; the guard must reject them (D-088)
describe('benchmark picks', () => {
  it('accepts the plain index funds', () => {
    expect(nameOk('nifty50', 'UTI Nifty 50 Index Fund - Direct Plan - Growth')).toBe(true);
    expect(nameOk('nifty500', 'Motilal Oswal Nifty 500 Index Fund - Direct Plan - Growth')).toBe(true);
    expect(nameOk('midcap150', 'Motilal Oswal Nifty Midcap 150 Index Fund - Direct Plan - Growth')).toBe(true);
    expect(nameOk('smallcap250', 'Motilal Oswal Nifty Smallcap 250 Index Fund - Direct Plan - Growth')).toBe(true);
  });
  it('rejects factor, next-50, regular and IDCW variants', () => {
    expect(nameOk('nifty50', 'UTI Nifty 500 Value 50 Index Fund - Direct Plan - Growth')).toBe(false);
    expect(nameOk('nifty500', 'Motilal Oswal Nifty 500 Momentum 50 Index Fund - Direct Plan - Growth')).toBe(false);
    expect(nameOk('nifty50', 'UTI Nifty Next 50 Index Fund - Direct Plan - Growth')).toBe(false);
    expect(nameOk('nifty500', 'Motilal Oswal Nifty 500 Index Fund - Regular Plan - Growth')).toBe(false);
    expect(nameOk('midcap150', 'Motilal Oswal Nifty Midcap 150 Index Fund - Direct Plan - IDCW')).toBe(false);
  });
});
