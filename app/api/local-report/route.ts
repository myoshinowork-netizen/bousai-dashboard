import { NextResponse } from 'next/server';
import { haversineKm, nearestPrefEntry } from '@/lib/geo';
import type { DisasterEvent } from '@/lib/model';

type NewsItem = {
  title: string;
  link: string;
  pubDate: string;
  source: string;
  sourceColor: string;
  description: string;
};

async function fetchNews(): Promise<NewsItem[]> {
  try {
    const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';
    const res = await fetch(`${base}/api/news`, { next: { revalidate: 300 } });
    if (!res.ok) return [];
    const data = await res.json();
    return data.items ?? [];
  } catch {
    return [];
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = parseFloat(searchParams.get('lat') ?? '');
  const lng = parseFloat(searchParams.get('lng') ?? '');

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: 'lat/lng required' }, { status: 400 });
  }

  const prefEntry = nearestPrefEntry(lat, lng);
  const keywords  = prefEntry.keywords;

  // ニュースを取得して地域キーワードでスコアリング
  const allNews = await fetchNews();
  const localNews = allNews
    .map((item) => {
      const text  = `${item.title} ${item.description}`;
      const score = keywords.reduce((s, kw) => s + (text.includes(kw) ? 2 : 0), 0);
      return { ...item, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  // 地震イベントをP2P地震APIから取得して周辺フィルタ
  const NEARBY_KM = 200;
  let nearbyEvents: (DisasterEvent & { distKm: number })[] = [];
  try {
    const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';
    const res = await fetch(`${base}/api/quake?limit=50`, { next: { revalidate: 60 } });
    if (res.ok) {
      const events: DisasterEvent[] = await res.json();
      nearbyEvents = events
        .filter((e) => e.location)
        .map((e) => ({
          ...e,
          distKm: haversineKm(lat, lng, e.location!.lat, e.location!.lng),
        }))
        .filter((e) => e.distKm <= NEARBY_KM)
        .sort((a, b) => a.distKm - b.distKm)
        .slice(0, 5);
    }
  } catch { /* ignore */ }

  return NextResponse.json({
    prefLabel:   prefEntry.label,
    prefCode:    prefEntry.code,
    keywords,
    localNews,
    nearbyEvents,
  }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
