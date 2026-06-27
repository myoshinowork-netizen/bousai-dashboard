import { NextResponse } from 'next/server';

type JmaTimeEntry = { validtime: string };

export async function GET() {
  try {
    const res = await fetch(
      'https://www.jma.go.jp/bosai/jmatile/data/nowc/targetTimes_N1.json',
      { next: { revalidate: 60 } }
    );
    if (!res.ok) throw new Error(`JMA API error: ${res.status}`);
    const data: JmaTimeEntry[] = await res.json();
    const latest = data.at(-1);
    if (!latest) throw new Error('No valid time found');
    return NextResponse.json({ validtime: latest.validtime });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to fetch nowcast time' }, { status: 502 });
  }
}
