export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import type { LinearPrecipBand } from '@/lib/model';

// ──────────────────────────────────────────────────────────────
// 線状降水帯情報
//
// 【表示ソース】気象庁（JMA）公式 JSON
//   - 速報性: 最速（気象庁が直接配信）
//   - 信頼性: 最高（政府公式）
//   - ユーザー信頼: 最高（NHK等が同ソースを使用）
//
// 【裏側整合】JSON 3候補 → XML フィードをフォールバック順に試行し、
//   取得できたソースを `source` フィールドで返す。
//   表示側は `source` を問わず bands の内容のみ使用する。
// ──────────────────────────────────────────────────────────────

// JMA 公式エンドポイント（優先順）
const CANDIDATE_URLS = [
  'https://www.jma.go.jp/bosai/flood/data/linear_precip_band/info.json',
  'https://www.jma.go.jp/bosai/hazard/data/linear_precip_band/info.json',
  'https://www.jma.go.jp/bosai/flood/data/linear_precip/info.json',
];

// 裏側整合用フォールバック（XML フィード）
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

type Result = { bands: LinearPrecipBand[]; source: string };

async function tryJsonEndpoints(): Promise<Result | null> {
  for (const url of CANDIDATE_URLS) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) continue;

      const raw = await res.json();
      const entries: JmaLinearEntry[] = Array.isArray(raw)
        ? raw
        : (raw?.observingArea ?? raw?.areas ?? raw?.items ?? raw?.data ?? []);

      if (!Array.isArray(entries) || entries.length === 0) continue;

      return {
        source: 'jma-json',
        bands: entries.map((e, i): LinearPrecipBand => ({
          id: `lp-${i}-${e.startTime ?? e.reportDatetime ?? Date.now()}`,
          area: e.area ?? e.areaName ?? e.prefName ?? e.observingArea ?? '不明',
          startedAt: e.startTime ?? e.reportDatetime ?? e.reportTime ?? new Date().toISOString(),
        })),
      };
    } catch { /* try next */ }
  }
  return null;
}

async function tryXmlFeed(): Promise<Result> {
  try {
    const res = await fetch(EXTRA_FEED_URL, { cache: 'no-store' });
    if (!res.ok) return { bands: [], source: 'jma-xml-empty' };
    const xml = await res.text();

    const bands: LinearPrecipBand[] = [];
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    let m: RegExpExecArray | null;
    let idx = 0;

    while ((m = entryRegex.exec(xml)) !== null) {
      const entry = m[1];
      if (!entry.includes('線状降水帯')) continue;

      const updatedMatch = entry.match(/<updated>([^<]+)<\/updated>/);

      // 地域名は content の冒頭にある「【熊本県気象解説情報…】」等から抽出する
      // （<title> は "府県気象情報" のような総称のため使えない）
      const contentMatch = entry.match(/<content[^>]*>([\s\S]{0,200}?)<\/content>|<content[^>]*>([\s\S]{0,200})/);
      const content = contentMatch?.[1] ?? contentMatch?.[2] ?? '';
      const prefMatch = content.match(/【?([^【】（）\s]+?[都道府県])/);
      const area = prefMatch?.[1]?.trim();
      if (!area || area === '府県') continue;

      // 同一地域の重複を排除
      if (bands.some((b) => b.area === area)) continue;

      bands.push({
        id: `lp-feed-${idx++}-${updatedMatch?.[1] ?? Date.now()}`,
        area,
        startedAt: updatedMatch?.[1] ?? new Date().toISOString(),
      });

      if (bands.length >= 10) break;
    }

    return { bands, source: 'jma-xml' };
  } catch {
    return { bands: [], source: 'jma-xml-error' };
  }
}

export async function GET() {
  // JMA 公式 JSON を優先（表示ソース）
  const fromJson = await tryJsonEndpoints();
  if (fromJson !== null) {
    return NextResponse.json(fromJson, { headers: { 'Cache-Control': 'no-store' } });
  }

  // 裏側整合: XML フィードにフォールバック
  const fromXml = await tryXmlFeed();
  return NextResponse.json(fromXml, { headers: { 'Cache-Control': 'no-store' } });
}
