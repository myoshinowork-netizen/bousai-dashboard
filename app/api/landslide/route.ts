import { NextResponse } from 'next/server';
import type { LandslideWarning } from '@/lib/model';

// 気象庁 土砂災害警戒情報（代表的な都道府県を定期取得）
// 気象庁警報APIは県コード単位のため、主要県を抽出
const PREF_CODES: Record<string, string> = {
  '011000': '北海道',
  '130000': '東京都',
  '140000': '神奈川県',
  '270000': '大阪府',
  '400000': '福岡県',
  '470000': '沖縄県',
};

type JmaWarningCode = { code: string; status: string };
type JmaArea = { code: string; name: string; warnings?: JmaWarningCode[] };
type JmaWarningData = { areaTypes?: Array<{ areas?: JmaArea[] }> };

const LANDSLIDE_CODES = new Set(['14', '15']); // 土砂災害警戒情報、大雨特別警報

export async function GET() {
  try {
    // 代表都道府県の警戒情報を並列取得
    const results = await Promise.allSettled(
      Object.entries(PREF_CODES).map(async ([code, name]) => {
        const res = await fetch(
          `https://www.jma.go.jp/bosai/warning/data/warning/${code}.json`,
          { next: { revalidate: 600 }, cache: 'no-store' }
        );
        if (!res.ok) return null;
        const data: JmaWarningData = await res.json();
        return { data, prefName: name, prefCode: code };
      })
    );

    const warnings: LandslideWarning[] = [];

    for (const result of results) {
      if (result.status !== 'fulfilled' || !result.value) continue;
      const { data, prefName, prefCode } = result.value;

      const areaTypes = data.areaTypes ?? [];
      for (const areaType of areaTypes) {
        for (const area of areaType.areas ?? []) {
          const activeWarnings = (area.warnings ?? []).filter(
            (w) => LANDSLIDE_CODES.has(w.code) && w.status === 'Active'
          );
          if (activeWarnings.length === 0) continue;
          const isEmergency = activeWarnings.some((w) => w.code === '15');
          warnings.push({
            id: `ls-${prefCode}-${area.code}`,
            prefecture: prefName,
            area: area.name,
            level: isEmergency ? 'emergency' : 'warning',
            issuedAt: new Date().toISOString(),
          });
        }
      }
    }

    return NextResponse.json({ warnings }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('[landslide]', err);
    return NextResponse.json({ warnings: [] }, { headers: { 'Cache-Control': 'no-store' } });
  }
}
