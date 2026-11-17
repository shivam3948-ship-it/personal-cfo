import { NextResponse } from 'next/server';

/** Session id from the client (random UUID kept in the browser). Only [a-z0-9-] allowed. */
export function sidOf(req: Request): string {
  const s = req.headers.get('x-sid') ?? new URL(req.url).searchParams.get('sid') ?? 'anon';
  // Anonymous sessions are bearer ids: at least 16 chars so they can't be guessed; underscores are reserved for signed-in ids.
  return /^[a-z0-9-]{16,64}$/i.test(s) ? s : 'anon';
}
export const json = (data: unknown, status = 200) => NextResponse.json(data, { status });
