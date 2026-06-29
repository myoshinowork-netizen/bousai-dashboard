export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import type { LandslideWarning, DisasterEvent, Severity } from '@/lib/model';

// 全47都道府県 + 北海道主要地方 の JMA警報APIコード
const PREF_CODES: Record<string, string> = {
  // 北海道（地方別）
  '011000': '北海道（宗谷）',
  '012000': '北海道（上川・留萌）',
  '013000': '北海道（網走・北見・紋別）',
  '014000': '北海道（釧路・根室）',
  '015000': '北海道（十勝）',
  '016000': '北海道（胆振・日高）',
  '017000': '北海道（石狩・空知・後志）',
  '018000': '北海道（渡島・桧山）',
  // 東北
  '020000': '青森県',
  '030000': '岩手県',
  '040000': '宮城県',
  '050000': '秋田県',
  '060000': '山形県',
  '070000': '福島県',
  // 関東・甲信
  '080000': '茨城県',
  '090000': '栃木県',
  '100000': '群馬県',
  '110000': '埼玉県',
  '120000': '千葉県',
  '130000': '東京都',
  '140000': '神奈川県',
  '190000': '山梨県',
  '200000': '長野県',
  // 北陸
  '150000': '新潟県',
  '160000': '富山県',
  '170000': '石川県',
  '180000': '福井県',
  // 東海
  '210000': '岐阜県',
  '220000': '静岡県',
  '230000': '愛知県',
  '240000': '三重県',
  // 近畿
  '250000': '滋賀県',
  '260000': '京都府',
  '270000': '大阪府',
  '280000': '兵庫県',
  '290000': '奈良県',
  '300000': '和歌山県',
  // 中国
  '310000': '鳥取県',
  '320000': '島根県',
  '330000': '岡山県',
  '340000': '広島県',
  '350000': '山口県',
  // 四国
  '360000': '徳島県',
  '370000': '香川県',
  '380000': '愛媛県',
  '390000': '高知県',
  // 九州
  '400000': '福岡県',
  '410000': '佐賀県',
  '420000': '長崎県',
  '430000': '熊本県',
  '440000': '大分県',
  '450000': '宮崎県',
  '460100': '鹿児島県',
  // 沖縄
  '471000': '沖縄本島地方',
  '472000': '大東島地方',
  '473000': '宮古島地方',
  '474000': '八重山地方',
};

type JmaWarningCode = { code: string; status: string };
type JmaArea = { code: string; name: string; warnings?: JmaWarningCode[] };
type JmaWarningData = { areaTypes?: Array<{ areas?: JmaArea[] }> };

// 土砂災害・大雨特別警報 → LandslideWarning（地図レイヤー用）
const LANDSLIDE_CODES = new Set(['14', '15']);

// 各警報コード定義
const WARNING_DEFS: Record<string, { type: DisasterEvent['type']; severity: Severity; label: string }> = {
  '02': { type: 'rain',    severity: 'warning',   label: '大雨警報'    },
  '03': { type: 'flood',   severity: 'warning',   label: '洪水警報'    },
  '10': { type: 'rain',    severity: 'advisory',  label: '大雨注意報'  },
  '11': { type: 'flood',   severity: 'advisory',  label: '洪水注意報'  },
  '15': { type: 'rain',    severity: 'emergency', label: '大雨特別警報' },
  '17': { type: 'thunder', severity: 'advisory',  label: '雷注意報'    },
  '24': { type: 'thunder', severity: 'advisory',  label: '雷注意報'    },
};

export async function GET() {
  try {
    const results = await Promise.allSettled(
      Object.entries(PREF_CODES).map(async ([code, prefName]) => {
        const res = await fetch(
          `https://www.jma.go.jp/bosai/warning/data/warning/${code}.json`,
          { cache: 'no-store' }
        );
        if (!res.ok) return null;
        const data: JmaWarningData = await res.json();
        return { data, prefName, prefCode: code };
      })
    );

    const warnings: LandslideWarning[] = [];
    const events: DisasterEvent[]      = [];
    const seenIds = new Set<string>();
    const issuedAt = new Date().toISOString();

    for (const result of results) {
      if (result.status !== 'fulfilled' || !result.value) continue;
      const { data, prefName, prefCode } = result.value;

      for (const areaType of data.areaTypes ?? []) {
        for (const area of areaType.areas ?? []) {
          const active = (area.warnings ?? []).filter((w) => w.status === 'Active');
          if (active.length === 0) continue;

          // 土砂災害 → LandslideWarning（地図レイヤーと両用）
          const lsCodes = active.filter((w) => LANDSLIDE_CODES.has(w.code));
          if (lsCodes.length > 0) {
            const isEmergency = lsCodes.some((w) => w.code === '15');
            warnings.push({
              id: `ls-${prefCode}-${area.code}`,
              prefecture: prefName,
              area: area.name,
              level: isEmergency ? 'emergency' : 'warning',
              issuedAt,
            });
          }

          // 大雨・洪水・雷 → DisasterEvent（フィード用）
          for (const w of active) {
            const def = WARNING_DEFS[w.code];
            if (!def) continue;
            const id = `warn-${prefCode}-${area.code}-${w.code}`;
            if (seenIds.has(id)) continue;
            seenIds.add(id);
            events.push({
              id,
              type: def.type,
              severity: def.severity,
              title: `${def.label} — ${prefName} ${area.name}`,
              occurredAt: issuedAt,
              area: [prefName, area.name],
              raw: w,
              source: 'jma-warning',
            });
          }
        }
      }
    }

    return NextResponse.json({ warnings, events }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('[landslide]', err);
    return NextResponse.json({ warnings: [], events: [] }, { headers: { 'Cache-Control': 'no-store' } });
  }
}
