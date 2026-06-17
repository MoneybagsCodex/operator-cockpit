import { NextResponse } from 'next/server';
import { readPreferences } from '@/src/lib/preferences';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json(readPreferences());
}
