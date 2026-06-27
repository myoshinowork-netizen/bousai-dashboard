import { NextResponse } from 'next/server';

type JmaTimeEntry = { validtime: string; basetime?: string };

export async function GET() {
  try {
    const res = await fetch(
      'https://www.jma.go.jp/bosai/jmatile/data/nowc/targetTimes_N1.json',
      { cache: 'no-store' }
    );
    if (!res.ok) throw new Error(`JMA error: ${res.status}`);
    const data: JmaTimeEntry[] = await res.json();
    // validtime は "YYYYMMDDHHMMSS" 形式
    const validtimes = data.map((d) => d.validtime).filter(Boolean);
    return NextResponse.json({ validtimes }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('[rain-history]', err);
    return NextResponse.json({ validtimes: [] }, { headers: { 'Cache-Control': 'no-store' } });
  }
}
