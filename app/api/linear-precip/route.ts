import { NextResponse } from 'next/server';
import type { LinearPrecipBand } from '@/lib/model';

// 気象庁 線状降水帯情報（複数エンドポイントを試行）
const CANDIDATE_URLS = [
  'https://www.jma.go.jp/bosai/flood/data/linear_precip_band/info.json',
  'https://www.jma.go.jp/bosai/hazard/data/linear_precip_band/info.json',
];

type JmaLinearEntry = {
  area?: string;
  areaName?: string;
  prefName?: string;
  startTime?: string;
  observingArea?: string;
  reportDatetime?: string;
};

export async function GET() {
  for (const url of CANDIDATE_URLS) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) continue;

      const raw = await res.json();
      const entries: JmaLinearEntry[] = Array.isArray(raw)
        ? raw
        : (raw?.observingArea ?? raw?.areas ?? raw?.items ?? []);

      const bands: LinearPrecipBand[] = entries.map((e, i): LinearPrecipBand => ({
        id: `lp-${i}-${e.startTime ?? Date.now()}`,
        area: e.area ?? e.areaName ?? e.prefName ?? e.observingArea ?? '不明',
        startedAt: e.startTime ?? e.reportDatetime ?? new Date().toISOString(),
      }));

      return NextResponse.json({ bands }, { headers: { 'Cache-Control': 'no-store' } });
    } catch { /* try next */ }
  }

  // APIが利用不可でも空配列で返す（エラーにしない）
  return NextResponse.json({ bands: [] }, { headers: { 'Cache-Control': 'no-store' } });
}
