import { describe, it, expect } from 'vitest';
import { PII } from '../evals/score';

describe('eval privacy pattern', () => {
  it('a made-up .example address is not a leak, even at the end of a sentence', () => {
    expect(PII.test('It’s addressed to support@cultfit.example.')).toBe(false);
    expect(PII.test('Write to billing@lingopro.example, then wait.')).toBe(false);
  });
  it('real-looking emails, PANs and long numbers still are', () => {
    expect(PII.test('mail me at asha.verma@gmail.com.')).toBe(true);
    expect(PII.test('PAN ABCDE1234F')).toBe(true);
    expect(PII.test('account 123456789012')).toBe(true);
    expect(PII.test('support@example.com')).toBe(true); // example.com is a real domain name
  });
});
