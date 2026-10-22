'use client';
// Fold your on-phone CAS into the Invest and X-ray view models, in the browser, with the same code the server uses for the
// sample family. Overlap needs each fund's holdings, which we don't have for real funds yet (D-OPEN-3), so that card hides.
import { loadCas } from './cas';
import { pfFrom, xrayFrom, xrsFrom, gateXR } from '@/lib/views/portfolioBlocks';
import type { AdviceMode } from '@/lib/advice';

type View = Record<string, unknown>;
export async function withMyCasInvest(v: View): Promise<View> {
  const c = await loadCas(); if (!c) return v;
  return { ...v, PF: pfFrom(c), XRS: xrsFrom(xrayFrom(c, {}, 'no fund holdings yet')), CAS_SRC: 'yours' };
}
export async function withMyCasXray(v: View): Promise<View> {
  const c = await loadCas(); if (!c) return v;
  const x = xrayFrom(c, {}, 'no fund holdings yet');
  return { ...v, PF: pfFrom(c), XR: gateXR(x.XR, (v.MODE as AdviceMode) ?? 'guided'), X3: x.X3, CAS_SRC: 'yours' };
}
