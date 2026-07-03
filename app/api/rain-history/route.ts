export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

// ──────────────────────────────────────────────────────────────
// 降水タイル フレーム一覧（タイムライン用）
//   - N1: 過去〜現在の観測（5分刻み, hrpns）
//   - N2: 1時間先までのナウキャスト予測（5分刻み, hrpns）
//   - rasrf: 最大15時間先までの降水短時間予報（1時間刻み）
// kind によってタイルURLのパスが変わる（クライアント側で組み立て）
// ──────────────────────────────────────────────────────────────

type JmaTimeEntry = { validtime: string; basetime: string; member?: string };

export type RainFrame = { basetime: string; validtime: string; kind: 'nowc' | 'rasrf' };

async function fetchTimes(url: string): Promise<JmaTimeEntry[]> {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function GET() {
  const [n1, n2, rasrf] = await Promise.all([
    fetchTimes('https://www.jma.go.jp/bosai/jmatile/data/nowc/targetTimes_N1.json'),
    fetchTimes('https://www.jma.go.jp/bosai/jmatile/data/nowc/targetTimes_N2.json'),
    fetchTimes('https://www.jma.go.jp/bosai/jmatile/data/rasrf/targetTimes.json'),
  ]);

  const frames: RainFrame[] = [
    ...n1.map((e): RainFrame => ({ basetime: e.basetime, validtime: e.validtime, kind: 'nowc' })),
    ...n2.map((e): RainFrame => ({ basetime: e.basetime, validtime: e.validtime, kind: 'nowc' })),
    // rasrf は1時間刻みの短時間予報。N2 の範囲(+1h)より先のみ採用
    ...rasrf
      .filter((e) => e.validtime > e.basetime)
      .map((e): RainFrame => ({ basetime: e.basetime, validtime: e.validtime, kind: 'rasrf' })),
  ]
    .filter((f) => f.basetime && f.validtime)
    .sort((a, b) => a.validtime.localeCompare(b.validtime));

  // 同一 validtime は nowc を優先（重複排除・後勝ちしないよう nowc 残し）
  const seen = new Map<string, RainFrame>();
  for (const f of frames) {
    const prev = seen.get(f.validtime);
    if (!prev || (prev.kind === 'rasrf' && f.kind === 'nowc')) seen.set(f.validtime, f);
  }
  const deduped = [...seen.values()].sort((a, b) => a.validtime.localeCompare(b.validtime));

  // 後方互換: validtimes（観測のみ）も返す
  const validtimes = n1.map((e) => e.validtime).filter(Boolean);

  return NextResponse.json(
    { frames: deduped, validtimes },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
