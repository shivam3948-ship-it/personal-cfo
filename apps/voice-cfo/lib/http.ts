import { NextResponse } from 'next/server';

/** Session id from the client (random UUID kept in the browser). Only [a-z0-9-] allowed. */
export function sidOf(req: Request): string {
  const s = req.headers.get('x-sid') ?? new URL(req.url).searchParams.get('sid') ?? 'anon';
  return /^[a-z0-9-]{4,64}$/i.test(s) ? s : 'anon';
}
export const json = (data: unknown, status = 200) => NextResponse.json(data, { status });
