import { NextResponse } from 'next/server';
import type { ForecastDay } from '@/lib/model';

// JMA 天気予報コード → テキスト
const CODE_TEXT: Record<string, string> = {
  '100': '晴れ', '101': '晴時々曇', '102': '晴一時雨', '103': '晴時々雨',
  '104': '晴一時雪', '110': '晴のち曇', '111': '晴のち時々曇', '112': '晴のち雨',
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

    // 1週間予報は json[1] に入っている（json[0] は3日予報）
    const weekly: JmaForecast = json[1] ?? json[0];
    const series = weekly?.timeSeries ?? [];

    // 天気・降水確率・気温の time series を取得
    const weatherSeries = series.find((s) => s.areas?.[0]?.weatherCodes);
    const popSeries     = series.find((s) => s.areas?.[0]?.pops);
    const tempSeries    = series.find((s) => s.areas?.[0]?.tempsMax);

    if (!weatherSeries) throw new Error('No weather series found');

    const area0 = weatherSeries.areas[0];
    const days: ForecastDay[] = weatherSeries.timeDefines.map((iso, i) => {
      const date = iso.slice(0, 10);
      const code = area0.weatherCodes?.[i] ?? '';
      const weather = CODE_TEXT[code] ?? area0.weathers?.[i] ?? '不明';
      const pop = parseInt(popSeries?.areas[0]?.pops?.[i] ?? '0', 10) || 0;
      const tMax = tempSeries?.areas[0]?.tempsMax?.[i];
      const tMin = tempSeries?.areas[0]?.tempsMin?.[i];
      return {
        date,
        weather,
        weatherCode: code,
        popMax: isNaN(pop) ? 0 : pop,
        tempMax: tMax && tMax !== '' ? parseInt(tMax, 10) : undefined,
        tempMin: tMin && tMin !== '' ? parseInt(tMin, 10) : undefined,
      };
    });

    return NextResponse.json({ days, areaName: area0.area?.name ?? '' });
  } catch (err) {
    console.error('[weather-forecast]', err);
    return NextResponse.json({ days: [], areaName: '' }, { status: 502 });
  }
}
