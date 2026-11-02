// Daily NAVs of four index funds for "against its index" on your own CAS (3 Nov 2026): the phone fetches these and compares
// on the phone. The request carries nothing about the user. Cached for a day.
import { NextResponse } from 'next/server';
import { benchSeries } from '@/lib/server/benchmarks';

export const runtime = 'nodejs';
export const revalidate = 86400;

export async function GET(req: Request) {
  const { series, info } = await benchSeries();
  if (new URL(req.url).searchParams.has('summary')) return NextResponse.json(info); // a quick look: which fund, how many days, from when
  return NextResponse.json({ series }, { headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=86400' } });
}
