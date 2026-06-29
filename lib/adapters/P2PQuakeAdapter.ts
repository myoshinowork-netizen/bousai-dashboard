import type { DisasterEvent, Severity } from '../model';
import type { EarthquakeSource } from './EarthquakeSource';

// P2P地震情報 APIレスポンス型（抜粋）
type P2PQuakeRecord = {
  id: string;
  code: number;
  time: string;
  issue?: { time: string; type: string };
  earthquake?: {
    time: string;
    hypocenter?: {
      name: string;
      latitude: number;
      longitude: number;
      depth: number;
      magnitude: number;
    };
    maxScale: number; // 震度×10
    domesticTsunami: string;
  };
  points?: { pref: string; addr: string; scale: number }[];
};

function maxScaleToSeverity(maxScale: number): Severity {
  if (maxScale >= 60) return 'emergency'; // 震度6弱以上
  if (maxScale >= 40) return 'warning';   // 震度4以上
  if (maxScale >= 20) return 'advisory';  // 震度2以上
  return 'info';
}

// domesticTsunami フィールドと津波の有無の対応
const TSUNAMI_NONE = new Set(['None', 'Unknown', 'Checking']);

function toDisasterEvent(record: P2PQuakeRecord): DisasterEvent {
  const eq   = record.earthquake;
  const hypo = eq?.hypocenter;
  const scale = eq?.maxScale ?? -1;
  const hasTsunami = eq?.domesticTsunami && !TSUNAMI_NONE.has(eq.domesticTsunami);
  const tsunamiSuffix = hasTsunami
    ? ` ⚠津波${eq!.domesticTsunami === 'Warning' ? '警報' : '注意報'}`
    : '';

  const prefSet = new Set(record.points?.map((p) => p.pref) ?? []);

  return {
    id: record.id,
    type: 'earthquake',
    severity: maxScaleToSeverity(scale),
    title: hypo?.name
      ? `${hypo.name} M${hypo.magnitude}${tsunamiSuffix}`
      : `地震情報${tsunamiSuffix}`,
    occurredAt: eq?.time ?? record.time,
    location:
      hypo && hypo.latitude !== -200
        ? { lat: hypo.latitude, lng: hypo.longitude }
        : undefined,
    area: prefSet.size > 0 ? Array.from(prefSet) : undefined,
    raw: record,
    source: 'p2pquake',
  };
}

export class P2PQuakeAdapter implements EarthquakeSource {
  private readonly baseUrl = 'https://api.p2pquake.net/v2';

  async fetchRecent(limit = 20): Promise<DisasterEvent[]> {
    const res = await fetch(
      `${this.baseUrl}/history?codes=551&limit=${limit}`,
      { cache: 'no-store' }
    );
    if (!res.ok) throw new Error(`P2PQuake API error: ${res.status}`);
    const data: P2PQuakeRecord[] = await res.json();
    return data.map(toDisasterEvent);
  }
}
