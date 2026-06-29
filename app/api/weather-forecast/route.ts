import { NextResponse } from 'next/server';
import type { ForecastDay } from '@/lib/model';

const CODE_TEXT: Record<string, string> = {
  '100': '晴れ', '101': '晴時々曇', '102': '晴一時雨', '103': '晴時々雨',
  '104': '晴一時雪', '110': '晴のち曇', '111': '晴のち時々晴', '112': '晴のち雨',
  '200': '曇り', '201': '曇時々晴', '202': '曇一時雨', '203': '曇時々雨',
  '204': '曇一時雪', '205': '曇時々雪', '210': '曇のち晴', '211': '曇のち時々晴',
  '212': '曇のち雨', '213': '曇のち時々雨', '214': '曇のち雪',
  '300': '雨', '301': '雨時々晴', '302': '雨時々止む', '303': '雨時々雪',
  '311': '雨のち晴', '313': '雨のち曇', '314': '雨のち雪',
  '400': '雪', '401': '雪時々晴', '402': '雪時々止む', '403': '雪時々雨',
  '411': '雪のち晴', '413': '雪のち曇', '414': '雪のち雨',
  '500': '暴風雨', '501': '暴風雪',
};

type JmaArea = {
  area: { name: string; code: string };
  weatherCodes?: string[];
  weathers?: string[];
  pops?: string[];
  temps?: string[];
  tempsMax?: string[];
  tempsMin?: string[];
};

type JmaTimeSeries = {
  timeDefines: string[];
  areas: JmaArea[];
};

type JmaForecast = {
  timeSeries: JmaTimeSeries[];
};

function safeInt(v: string | undefined): number | undefined {
  if (!v || v === '') return undefined;
  const n = parseInt(v, 10);
  return isNaN(n) ? undefined : n;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const area = searchParams.get('area') ?? '130000';

  try {
    const res = await fetch(
      `https://www.jma.go.jp/bosai/forecast/data/forecast/${area}.json`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) throw new Error(`JMA forecast error: ${res.status}`);
    const json: JmaForecast[] = await res.json();

    // json[0]: 3日予報（今日・明日・明後日の詳細）
    // json[1]: 週間予報（明日〜7日後、気温幅付き）
    const short  = json[0];
    const weekly = json[1] ?? json[0];

    // ── 3日予報から基本情報を取得 ──
    const shortWeather = short?.timeSeries?.find((s) => s.areas?.[0]?.weatherCodes);
    const shortPop     = short?.timeSeries?.find((s) => s.areas?.[0]?.pops);
    const shortTemp    = short?.timeSeries?.find((s) => s.areas?.[0]?.temps);

    const shortA = shortWeather?.areas[0];

    // 今日の日付
    const todayIso  = shortWeather?.timeDefines[0];
    const todayDate = todayIso?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
    const todayCode = shortA?.weatherCodes?.[0] ?? '';

    // ── 今日の降水確率: 6h 区切りの最大値を採用 ──
    let todayPop = 0;
    if (shortPop) {
      const aPops = shortPop.areas[0]?.pops ?? [];
      const vals  = shortPop.timeDefines
        .map((iso, i) => ({ d: iso.slice(0, 10), v: safeInt(aPops[i]) }))
        .filter((x) => x.d === todayDate && x.v !== undefined)
        .map((x) => x.v!);
      if (vals.length > 0) todayPop = Math.max(...vals);
    }

    // ── 今日・明日の気温: timeDefines の日付で判定 ──
    // JMA 慣例: 00:00〜06:00 = 最低気温、09:00〜 = 最高気温
    let todayTempMax: number | undefined;
    let todayTempMin: number | undefined;
    let tomorrowTempMax: number | undefined;
    let tomorrowTempMin: number | undefined;

    const tomorrowDate = shortWeather?.timeDefines[1]?.slice(0, 10);

    if (shortTemp) {
      const aTemps = shortTemp.areas[0]?.temps ?? [];
      shortTemp.timeDefines.forEach((iso, i) => {
        const d    = iso.slice(0, 10);
        const hour = parseInt(iso.slice(11, 13) || '0', 10);
        const v    = safeInt(aTemps[i]);
        if (v === undefined) return;
        if (d === todayDate) {
          if (hour >= 9) { todayTempMax = v; } else { todayTempMin = v; }
        } else if (tomorrowDate && d === tomorrowDate) {
          if (hour >= 9) { tomorrowTempMax = v; } else { tomorrowTempMin = v; }
        }
      });
    }

    const today: ForecastDay = {
      date: todayDate,
      weather: CODE_TEXT[todayCode] ?? shortA?.weathers?.[0] ?? '不明',
      weatherCode: todayCode,
      popMax: todayPop,
      tempMax: todayTempMax,
      tempMin: todayTempMin,
    };

    // ── 週間予報を取得（明日〜） ──
    const wSeries  = weekly?.timeSeries ?? [];
    const wWeather = wSeries.find((s) => s.areas?.[0]?.weatherCodes);
    const wTemp    = wSeries.find((s) => s.areas?.[0]?.tempsMax);

    if (!wWeather) throw new Error('No weather series found');

    const wA    = wWeather.areas[0];
    const wTmpA = wTemp?.areas[0];

    const weeklyDays: ForecastDay[] = wWeather.timeDefines.map((iso, i) => {
      const date   = iso.slice(0, 10);
      const code   = wA.weatherCodes?.[i] ?? '';
      const rawPop = wA.pops?.[i];
      const pop    = rawPop && rawPop !== '' ? parseInt(rawPop, 10) : 0;

      let tMax = safeInt(wTmpA?.tempsMax?.[i]);
      let tMin = safeInt(wTmpA?.tempsMin?.[i]);

      // 明日分は週間予報の気温が空のことが多い → 3日予報の値で補完
      if (date === tomorrowDate) {
        if (tMax === undefined) tMax = tomorrowTempMax;
        if (tMin === undefined) tMin = tomorrowTempMin;
      }

      return {
        date,
        weather: CODE_TEXT[code] ?? '不明',
        weatherCode: code,
        popMax: isNaN(pop) ? 0 : pop,
        tempMax: tMax,
        tempMin: tMin,
      };
    });

    // 今日が週間予報に含まれていない場合は先頭に追加
    const days: ForecastDay[] = weeklyDays[0]?.date === todayDate
      ? weeklyDays
      : [today, ...weeklyDays];

    // 週間予報に含まれている今日の行に気温が欠けている場合は補完
    if (days[0]?.date === todayDate) {
      if (days[0].tempMax === undefined) days[0] = { ...days[0], tempMax: todayTempMax };
      if (days[0].tempMin === undefined) days[0] = { ...days[0], tempMin: todayTempMin };
    }

    return NextResponse.json({ days, areaName: wA.area?.name ?? shortA?.area?.name ?? '' });
  } catch (err) {
    console.error('[weather-forecast]', err);
    return NextResponse.json({ days: [], areaName: '' }, { status: 502 });
  }
}
