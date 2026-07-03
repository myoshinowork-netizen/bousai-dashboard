export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

// ──────────────────────────────────────────────────────────────
// 雷ナウキャスト タイル時刻
//   雷ナウキャスト（thns）の時刻一覧は nowc/targetTimes_N3.json にある。
//   過去約3時間の観測 + 1時間先までの予測を含む（10分刻み）。
//   タイルURL: nowc/{basetime}/none/{validtime}/surf/thns/{z}/{x}/{y}.png
// ──────────────────────────────────────────────────────────────

type JmaTimeEntry = { validtime: string; basetime: string; elements?: string[] };

export async function GET() {
  try {
    const res = await fetch(
      'https://www.jma.go.jp/bosai/jmatile/data/nowc/targetTimes_N3.json',
      { cache: 'no-store' }
    );
    if (!res.ok) throw new Error(`JMA N3 error: ${res.status}`);
    const data: JmaTimeEntry[] = await res.json();

    const frames = data
      .filter((e) => e.basetime && e.validtime && (e.elements?.includes('thns') ?? true))
      .map((e) => ({ basetime: e.basetime, validtime: e.validtime }))
      .sort((a, b) => a.validtime.localeCompare(b.validtime));

    // 「現在」= 観測の最新（basetime === validtime の最大）
    const latestObs = frames.filter((f) => f.basetime === f.validtime).at(-1) ?? frames.at(-1);

    return NextResponse.json(
      { validtime: latestObs?.validtime ?? null, basetime: latestObs?.basetime ?? null, frames },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    console.error('[thunder-nowcast]', err);
    return NextResponse.json({ error: 'Thunder data not available' }, { status: 404 });
  }
}
