// What this browser gets right now: Claude or the rules engine, Sarvam or the browser's voice (D-062). No secrets.
import { NextResponse } from 'next/server';
import { aiConfig } from '@/lib/aiConfig';

export const dynamic = 'force-dynamic';
export async function GET(req: Request) { return NextResponse.json(aiConfig(req), { headers: { 'Cache-Control': 'no-store' } }); }
