export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import type { DisasterEvent, Severity } from '@/lib/model';

// P2PQuake code 552: 津波予報  code 553: 津波情報
type P2PTsunamiArea = {
  grade: 'MajorWarning' | 'Warning' | 'Watch' | 'Unknown';
  name: string;
  immediate?: boolean;
  firstHeight?: { arrivalTime?: string; condition?: string };
  maxHeight?: { value?: string; description?: string };
};

type P2PTsunamiRecord = {
  id: string;
  code: number;
  time: string;
  issue?: { source?: string; time?: string; type?: string; revision?: number };
  cancelled: boolean;
  areas?: P2PTsunamiArea[];
};

function gradeToSeverity(grade: P2PTsunamiArea['grade']): Severity {
  if (grade === 'MajorWarning') return 'emergency'; // 大津波警報
  if (grade === 'Warning')      return 'warning';   // 津波警報
  if (grade === 'Watch')        return 'advisory';  // 津波注意報
  return 'info';
}

function gradeToLabel(grade: P2PTsunamiArea['grade']): string {
  if (grade === 'MajorWarning') return '大津波警報';
  if (grade === 'Warning')      return '津波警報';
  if (grade === 'Watch')        return '津波注意報';
  return '津波情報';
}

function worstGrade(areas: P2PTsunamiArea[]): P2PTsunamiArea['grade'] {
  const order: P2PTsunamiArea['grade'][] = ['MajorWarning', 'Warning', 'Watch', 'Unknown'];
  return areas.reduce<P2PTsunamiArea['grade']>(
    (worst, a) => (order.indexOf(a.grade) < order.indexOf(worst) ? a.grade : worst),
    'Unknown'
  );
}

export async function GET() {
  try {
    const res = await fetch(
      'https://api.p2pquake.net/v2/history?codes=552&limit=10',
      { cache: 'no-store' }
    );
    if (!res.ok) throw new Error(`P2PQuake tsunami API error: ${res.status}`);
    const data: P2PTsunamiRecord[] = await res.json();

    const events: DisasterEvent[] = [];

    for (const record of data) {
      // キャンセル済みまたはエリアなしはスキップ
      if (record.cancelled || !record.areas || record.areas.length === 0) continue;

      const grade    = worstGrade(record.areas);
      const severity = gradeToSeverity(grade);
      const label    = gradeToLabel(grade);
      const areaNames = record.areas
        .filter((a) => a.grade !== 'Unknown')
        .map((a) => a.name);

      // 注意報(advisory)以上のみ表示
      if (severity === 'info') continue;

      events.push({
        id: record.id,
        type: 'tsunami',
        severity,
        title: `${label} — ${areaNames.slice(0, 3).join('・')}${areaNames.length > 3 ? ` 他${areaNames.length - 3}地域` : ''}`,
        occurredAt: record.issue?.time ?? record.time,
        area: areaNames,
        raw: record,
        source: 'p2pquake-tsunami',
      });
    }

    return NextResponse.json(events, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('[tsunami]', err);
    return NextResponse.json([], { headers: { 'Cache-Control': 'no-store' } });
  }
}
