import { NextResponse } from 'next/server';
import { P2PQuakeAdapter } from '@/lib/adapters/P2PQuakeAdapter';

export const dynamic = 'force-dynamic';

const adapter = new P2PQuakeAdapter();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get('limit') ?? '10'), 50);

  try {
    const events = await adapter.fetchRecent(limit);
    return NextResponse.json(events, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to fetch earthquake data' }, { status: 502 });
  }
}
