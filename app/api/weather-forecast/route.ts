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

    // ── 3日予報から今日・明日を取得 ──
    const shortWeather = short?.timeSeries?.find((s) => s.areas?.[0]?.weatherCodes);
    const shortPop     = short?.timeSeries?.find((s) => s.areas?.[0]?.pops);
    const shortTemp    = short?.timeSeries?.find((s) => s.areas?.[0]?.temps); // min/max 2値

    // 3日予報の天気コード: [今日(17:00〜), 明日, 明後日]
    const shortA     = shortWeather?.areas[0];
    const shortPopA  = shortPop?.areas[0];
    const shortTempA = shortTemp?.areas[0]; // temps[0]=明日min, temps[1]=明日max

    // 今日の日付
    const todayIso = shortWeather?.timeDefines[0]; // "2026-06-28T17:00:00+09:00"
    const todayDate = todayIso?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
    const todayCode = shortA?.weatherCodes?.[0] ?? '';

    // 今日の降水確率: 3日予報 popsは6h単位。最初のエントリ（今日夜の値）を使う
    const todayPop = safeInt(shortPopA?.pops?.[0]) ?? 0;

    const today: ForecastDay = {
      date: todayDate,
      weather: CODE_TEXT[todayCode] ?? shortA?.weathers?.[0] ?? '不明',
      weatherCode: todayCode,
      popMax: todayPop,
      // 今日の気温は3日予報では提供されないため undefined
      tempMax: undefined,
      tempMin: undefined,
    };

    // 明日の日付と気温（3日予報の temps[0]=min, temps[1]=max が明日分）
    const tomorrowDate = shortWeather?.timeDefines[1]?.slice(0, 10);
    const tomorrowTempMin = safeInt(shortTempA?.temps?.[0]);
    const tomorrowTempMax = safeInt(shortTempA?.temps?.[1]);

    // ── 週間予報を取得（明日〜） ──
    const wSeries = weekly?.timeSeries ?? [];
    const wWeather = wSeries.find((s) => s.areas?.[0]?.weatherCodes);
    const wTemp    = wSeries.find((s) => s.areas?.[0]?.tempsMax);

    if (!wWeather) throw new Error('No weather series found');

    const wA    = wWeather.areas[0];
    const wPopA = wWeather.areas[0]; // pops が weatherCodes と同じ series に入っている
    const wTmpA = wTemp?.areas[0];

    const weeklyDays: ForecastDay[] = wWeather.timeDefines.map((iso, i) => {
      const date = iso.slice(0, 10);
      const code = wA.weatherCodes?.[i] ?? '';
      const rawPop = wA.pops?.[i];
      const pop = rawPop && rawPop !== '' ? parseInt(rawPop, 10) : 0;

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

    return NextResponse.json({ days, areaName: wA.area?.name ?? shortA?.area?.name ?? '' });
  } catch (err) {
    console.error('[weather-forecast]', err);
    return NextResponse.json({ days: [], areaName: '' }, { status: 502 });
  }
}
