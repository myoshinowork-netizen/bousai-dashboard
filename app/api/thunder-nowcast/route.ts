export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

type JmaTimeEntry = { validtime: string };

const CANDIDATE_URLS = [
  'https://www.jma.go.jp/bosai/jmatile/data/thunder/targetTimes_thunder.json',
  'https://www.jma.go.jp/bosai/jmatile/data/thunder/targetTimes_td.json',
  'https://www.jma.go.jp/bosai/jmatile/data/rasrf/targetTimes_rasrf.json',
];

export async function GET() {
  for (const url of CANDIDATE_URLS) {
    try {
      const res = await fetch(url, { next: { revalidate: 60 } });
      if (!res.ok) continue;
      const data: JmaTimeEntry[] = await res.json();
      const latest = data.at(-1);
      if (latest?.validtime) {
        return NextResponse.json({ validtime: latest.validtime });
      }
    } catch { /* try next */ }
  }
  return NextResponse.json({ error: 'Thunder data not available' }, { status: 404 });
}
