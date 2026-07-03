export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

type JmaTimeEntry = { validtime: string };

export async function GET() {
  try {
    const res = await fetch(
      'https://www.jma.go.jp/bosai/jmatile/data/nowc/targetTimes_N1.json',
      { cache: 'no-store' }
    );
    if (!res.ok) throw new Error(`JMA API error: ${res.status}`);
    const data: JmaTimeEntry[] = await res.json();
    // JMA の配列は新しい順とは限らないため validtime の最大値を明示的に選ぶ
    const latest = data.reduce<JmaTimeEntry | null>(
      (m, e) => (!m || e.validtime > m.validtime ? e : m), null);
    if (!latest) throw new Error('No valid time found');
    return NextResponse.json({ validtime: latest.validtime }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to fetch nowcast time' }, { status: 502 });
  }
}
