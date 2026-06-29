export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import type { TyphoonInfo, TyphoonClassType, TyphoonTrackPoint } from '@/lib/model';

const TARGET_TC_URL   = 'https://www.jma.go.jp/bosai/typhoon/data/targetTc.json';
const OTHER_FEED_URL  = 'https://www.data.jma.go.jp/developer/xml/feed/other_l.xml';
const BEST_TRACK_URL  = 'https://www.jma.go.jp/jma/jma-eng/jma-center/rsmc-hp-pub-eg/Besttracks/bst2026.txt';
const XML_BASE        = 'https://www.data.jma.go.jp';

type TargetTcEntry = {
  tropicalCyclone: string;
  typhoonNumber: string;
  category: string;
  issue: string;
};

type XmlTcEntry = {
  typhoonNumber: string;
  name: string;
  nameKana: string;
  lat: number;
  lng: number;
  time: string;
  pressureHPa?: number;
  maxWindKt?: number;
  tcClassJa: string;
};

type BestTrackTc = {
  typhoonNumber: string;
  name: string;
  points: TyphoonTrackPoint[];
};

// ── ISO 6709 座標パーサ: "+35.0+140.2/" → [35.0, 140.2] ──────────────────
function parseISO6709(coord: string): [number, number] | null {
  const m = coord.match(/([+-]\d+\.?\d*)([+-]\d+\.?\d*)/);
  if (!m) return null;
  return [parseFloat(m[1]), parseFloat(m[2])];
}

// ── 日本語台風階級 → TyphoonClassType ────────────────────────────────────
function jaClassToType(ja: string, maxWindKt?: number): TyphoonClassType {
  if (ja.includes('温帯')) return 'ET';
  if (ja.includes('熱帯低気圧')) return 'TD';
  if (ja.includes('台風')) {
    // 台風のサブ分類: 最大風速で区別
    const kt = maxWindKt ?? 0;
    if (kt >= 105) return 'TY'; // 猛烈な / 非常に強い
    if (kt >= 64)  return 'TY';
    if (kt >= 48)  return 'STS';
    if (kt >= 34)  return 'TS';
    return 'TS';
  }
  return 'unknown';
}

// ── targetTc.json category → TyphoonClassType ────────────────────────────
function categoryToType(cat: string): TyphoonClassType {
  const map: Record<string, TyphoonClassType> = {
    TY: 'TY', STS: 'STS', TS: 'TS', TD: 'TD', ETL: 'ET', ET: 'ET',
    LOW: 'ET', EX: 'ET', REMNANTS: 'TD',
  };
  return map[cat] ?? 'unknown';
}

// ── 全般海上警報 XML を解析して台風位置リストを返す ─────────────────────
function parseSeaWarningXml(xml: string, reportTime: string): XmlTcEntry[] {
  const results: XmlTcEntry[] = [];
  const itemRegex = /<Item>([\s\S]*?)<\/Item>/g;
  let itemMatch: RegExpExecArray | null;
  while ((itemMatch = itemRegex.exec(xml)) !== null) {
    const item = itemMatch[1];
    if (!item.includes('TyphoonNamePart')) continue;

    const numMatch    = item.match(/<Number>(\d+)<\/Number>/);
    const nameMatch   = item.match(/<Name>([A-Z]{2,})<\/Name>/);
    const kanaMatch   = item.match(/<NameKana>([^<]+)<\/NameKana>/);
    if (!numMatch) continue;

    // 実況 Kind を探す
    const kindRegex = /<Kind>([\s\S]*?)<\/Kind>/g;
    let kindMatch: RegExpExecArray | null;
    while ((kindMatch = kindRegex.exec(item)) !== null) {
      const kind = kindMatch[1];
      if (!kind.includes('実況')) continue;

      const dtMatch    = kind.match(/type="実況">([^<]+)</);
      const coordMatch = kind.match(/type="中心位置（度）"[^>]*>([^<]+)/);
      const pressMatch = kind.match(/type="中心気圧"[^>]*>\s*(\d+)/);
      const windMatch  = kind.match(/type="最大風速"[^>]*>\s*(\d+)/);
      const classMatch = kind.match(/<jmx_eb:TyphoonClass[^>]*>([^<]+)<\/jmx_eb:TyphoonClass>/);
      if (!coordMatch) continue;

      const coords = parseISO6709(coordMatch[1]);
      if (!coords) continue;
      const [lat, lng] = coords;
      const maxWindKt = windMatch ? +windMatch[1] : undefined;

      results.push({
        typhoonNumber: numMatch[1],
        name:     nameMatch?.[1] ?? '',
        nameKana: kanaMatch?.[1] ?? '',
        lat, lng,
        time:       dtMatch?.[1] ?? reportTime,
        pressureHPa: pressMatch ? +pressMatch[1] : undefined,
        maxWindKt,
        tcClassJa:   classMatch?.[1]?.trim() ?? '',
      });
    }
  }
  return results;
}

// ── RSMC Best Track テキストを解析 ───────────────────────────────────────
function parseBestTrack(text: string): BestTrackTc[] {
  const II_MAP: Record<number, TyphoonClassType> = {
    2: 'TD', 3: 'TS', 4: 'STS', 5: 'TY', 6: 'ET',
  };
  const tcs: BestTrackTc[] = [];
  let current: BestTrackTc | null = null;

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trimEnd();
    if (!line) continue;

    if (line.startsWith('66666')) {
      // ヘッダー行: "66666 YYNN  NNN ..."
      const parts = line.trim().split(/\s+/);
      const yyNN = parts[1]; // "2601"
      const nameMatch = line.match(/\b([A-Z]{4,})\b/);
      current = {
        typhoonNumber: yyNN,
        name: nameMatch?.[1] ?? '',
        points: [],
      };
      tcs.push(current);
    } else if (current && /^\d{8}\s/.test(line)) {
      // データ行: "YYMMDDHH AAA II LAT*10 LON*10 PRES WIND ..."
      const parts = line.trim().split(/\s+/);
      if (parts.length < 7) continue;
      const dateStr  = parts[0];
      const ii       = parseInt(parts[2]);
      const lat      = parseInt(parts[3]) / 10;
      const lng      = parseInt(parts[4]) / 10;
      const pressure = parseInt(parts[5]);
      const windKt   = parseInt(parts[6]);

      const year  = 2000 + parseInt(dateStr.slice(0, 2));
      const month = parseInt(dateStr.slice(2, 4)) - 1;
      const day   = parseInt(dateStr.slice(4, 6));
      const hour  = parseInt(dateStr.slice(6, 8));
      const time  = new Date(Date.UTC(year, month, day, hour)).toISOString();

      current.points.push({
        lat, lng, time,
        classType:   II_MAP[ii] ?? 'unknown',
        pressureHPa: pressure > 0 ? pressure : undefined,
        maxWindKt:   windKt > 0 ? windKt : undefined,
        forecast:    false,
      });
    }
  }
  return tcs;
}

// ── メインフェッチ ────────────────────────────────────────────────────────
async function safeFetch(url: string, opts?: RequestInit): Promise<string | null> {
  try {
    const res = await fetch(url, { cache: 'no-store', ...opts });
    if (!res.ok) return null;
    return res.text();
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    // 1. 現在アクティブな台風リスト
    const tcListText = await safeFetch(TARGET_TC_URL);
    const tcList: TargetTcEntry[] = tcListText ? JSON.parse(tcListText) : [];

    // 2. other_l.xml から全般海上警報の最新エントリを取得（最大12件 ≒ 24h分）
    const feedText  = await safeFetch(OTHER_FEED_URL);
    const warningUrls: { url: string; updated: string }[] = [];
    if (feedText) {
      const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
      let m: RegExpExecArray | null;
      while ((m = entryRegex.exec(feedText)) !== null) {
        const entry = m[1];
        if (!entry.includes('全般海上警報')) continue;
        const linkMatch    = entry.match(/href="([^"]+)"/);
        const updatedMatch = entry.match(/<updated>([^<]+)<\/updated>/);
        if (!linkMatch) continue;
        const href = linkMatch[1].startsWith('/') ? XML_BASE + linkMatch[1] : linkMatch[1];
        warningUrls.push({ url: href, updated: updatedMatch?.[1] ?? '' });
        if (warningUrls.length >= 12) break;
      }
    }

    // 3. 各XMLをパースして台風位置履歴を構築
    //    typhoonNumber → XmlTcEntry[]（時系列）
    const historyMap = new Map<string, XmlTcEntry[]>();

    await Promise.all(
      warningUrls.map(async ({ url, updated }) => {
        const xml = await safeFetch(url);
        if (!xml) return;
        const entries = parseSeaWarningXml(xml, updated);
        for (const entry of entries) {
          const list = historyMap.get(entry.typhoonNumber) ?? [];
          list.push(entry);
          historyMap.set(entry.typhoonNumber, list);
        }
      })
    );

    // 時系列ソート
    for (const [key, list] of historyMap) {
      historyMap.set(key, list.sort((a, b) => a.time.localeCompare(b.time)));
    }

    // 4. RSMC Best Track を解析（完了した台風の詳細履歴）
    const btText = await safeFetch(BEST_TRACK_URL);
    const bestTrackTcs: BestTrackTc[] = btText ? parseBestTrack(btText) : [];
    const btMap = new Map(bestTrackTcs.map((tc) => [tc.typhoonNumber, tc]));

    // 5. 結果をアセンブル
    const typhoons: TyphoonInfo[] = [];

    // ── アクティブ台風 ──
    // LOW（低気圧に変質）は非表示
    const SKIP_CATEGORIES = new Set(['LOW', 'EX', 'REMNANTS']);

    for (const tc of tcList) {
      if (SKIP_CATEGORIES.has(tc.category)) continue;

      const xmlHistory = historyMap.get(tc.typhoonNumber) ?? [];
      const latest = xmlHistory.at(-1);
      if (!latest) {
        // 位置情報がXMLから取れなかった場合はスキップ
        continue;
      }

      const category = categoryToType(tc.category);
      const history: TyphoonTrackPoint[] = xmlHistory.map((e) => ({
        lat:         e.lat,
        lng:         e.lng,
        time:        e.time,
        classType:   jaClassToType(e.tcClassJa, e.maxWindKt),
        pressureHPa: e.pressureHPa,
        maxWindKt:   e.maxWindKt,
        forecast:    false,
      }));

      // Best Track にも同じ番号があれば先頭に付加
      const bt = btMap.get(tc.typhoonNumber);
      if (bt) {
        const btFiltered = bt.points.filter(
          (p) => new Date(p.time) < new Date(history[0]?.time ?? '9999')
        );
        history.unshift(...btFiltered);
      }

      typhoons.push({
        id:          tc.tropicalCyclone,
        name:        latest.nameKana || latest.name || `台風${tc.typhoonNumber}号`,
        nameEn:      latest.name,
        lat:         latest.lat,
        lng:         latest.lng,
        pressureHPa: latest.pressureHPa ?? 0,
        maxWindMs:   Math.round((latest.maxWindKt ?? 0) * 0.514),
        maxWindKt:   latest.maxWindKt ?? 0,
        category,
        track:       [], // 予報トラックは現状未取得
        history,
      });
    }

    // ── 完了した台風（Best Track のみに存在） ──
    // 最後の観測点が30日以上前のものは非表示
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    const activeTcNumbers = new Set(tcList.map((t) => t.typhoonNumber));
    for (const bt of bestTrackTcs) {
      if (activeTcNumbers.has(bt.typhoonNumber)) continue;
      if (bt.points.length === 0) continue;

      const lastTime = new Date(bt.points.at(-1)!.time).getTime();
      if (Date.now() - lastTime > THIRTY_DAYS_MS) continue;

      const lastPt   = bt.points.at(-1)!;
      const firstPt  = bt.points[0];
      const pressure = bt.points.reduce(
        (min, p) => (p.pressureHPa && p.pressureHPa < min ? p.pressureHPa : min), 9999
      );
      const maxWind  = bt.points.reduce(
        (max, p) => (p.maxWindKt && p.maxWindKt > max ? p.maxWindKt : max), 0
      );

      typhoons.push({
        id:          `bt-${bt.typhoonNumber}`,
        name:        bt.name,
        nameEn:      bt.name,
        lat:         lastPt.lat,
        lng:         lastPt.lng,
        pressureHPa: pressure < 9999 ? pressure : 0,
        maxWindMs:   Math.round(maxWind * 0.514),
        maxWindKt:   maxWind,
        category:    lastPt.classType,
        track:       [],
        history:     bt.points,
      });
    }

    return NextResponse.json({ typhoons }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('[typhoon]', err);
    return NextResponse.json({ typhoons: [] }, { headers: { 'Cache-Control': 'no-store' } });
  }
}
