import { NextResponse } from 'next/server';
import type { LinearPrecipBand } from '@/lib/model';

// 気象庁 線状降水帯情報（複数エンドポイントを順番に試行）
const CANDIDATE_URLS = [
  'https://www.jma.go.jp/bosai/flood/data/linear_precip_band/info.json',
  'https://www.jma.go.jp/bosai/hazard/data/linear_precip_band/info.json',
  'https://www.jma.go.jp/bosai/flood/data/linear_precip/info.json',
];

// JMA extra フィード から線状降水帯エントリを抽出するフォールバック
const EXTRA_FEED_URL = 'https://www.data.jma.go.jp/developer/xml/feed/extra_l.xml';

type JmaLinearEntry = {
  area?: string;
  areaName?: string;
  prefName?: string;
  startTime?: string;
  observingArea?: string;
  reportDatetime?: string;
  reportTime?: string;
};

async function tryJsonEndpoints(): Promise<LinearPrecipBand[] | null> {
  for (const url of CANDIDATE_URLS) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) continue;

      const raw = await res.json();
      const entries: JmaLinearEntry[] = Array.isArray(raw)
        ? raw
        : (raw?.observingArea ?? raw?.areas ?? raw?.items ?? raw?.data ?? []);

      if (!Array.isArray(entries) || entries.length === 0) continue;

      return entries.map((e, i): LinearPrecipBand => ({
        id: `lp-${i}-${e.startTime ?? e.reportDatetime ?? Date.now()}`,
        area: e.area ?? e.areaName ?? e.prefName ?? e.observingArea ?? '不明',
        startedAt: e.startTime ?? e.reportDatetime ?? e.reportTime ?? new Date().toISOString(),
      }));
    } catch { /* try next */ }
  }
  return null;
}

async function tryXmlFeed(): Promise<LinearPrecipBand[]> {
  try {
    const res = await fetch(EXTRA_FEED_URL, { cache: 'no-store' });
    if (!res.ok) return [];
    const xml = await res.text();

    const bands: LinearPrecipBand[] = [];
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    let m: RegExpExecArray | null;
    let idx = 0;

    while ((m = entryRegex.exec(xml)) !== null) {
      const entry = m[1];
      if (!entry.includes('線状降水帯')) continue;

      const titleMatch   = entry.match(/<title>([^<]+)<\/title>/);
      const updatedMatch = entry.match(/<updated>([^<]+)<\/updated>/);

      const title = titleMatch?.[1] ?? '線状降水帯情報';
      // タイトルから地域名を抽出（例: "大雨情報（線状降水帯）高知県"）
      const areaMatch = title.match(/）\s*(.+)$/) ?? title.match(/（線状降水帯）(.+)$/);
      const area = areaMatch?.[1]?.trim() ?? title;

      bands.push({
        id: `lp-feed-${idx++}-${updatedMatch?.[1] ?? Date.now()}`,
        area,
        startedAt: updatedMatch?.[1] ?? new Date().toISOString(),
      });

      if (bands.length >= 10) break;
    }

    return bands;
  } catch {
    return [];
  }
}

export async function GET() {
  const fromJson = await tryJsonEndpoints();
  if (fromJson !== null) {
    return NextResponse.json({ bands: fromJson }, { headers: { 'Cache-Control': 'no-store' } });
  }

  // フォールバック: JMA extra XMLフィードを解析
  const fromXml = await tryXmlFeed();
  return NextResponse.json({ bands: fromXml }, { headers: { 'Cache-Control': 'no-store' } });
}
