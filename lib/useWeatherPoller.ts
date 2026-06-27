'use client';

import { useEffect } from 'react';
import { useDisasterStore } from '@/store/useDisasterStore';
import type { TyphoonInfo, LinearPrecipBand, LandslideWarning, DisasterEvent } from '@/lib/model';

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return res.json() as Promise<T>;
  } catch {
    return null;
  }
}

export function useWeatherPoller() {
  const setThunderTileTime   = useDisasterStore((s) => s.setThunderTileTime);
  const setTyphoons          = useDisasterStore((s) => s.setTyphoons);
  const setLinearPrecipBands = useDisasterStore((s) => s.setLinearPrecipBands);
  const setLandslideWarnings = useDisasterStore((s) => s.setLandslideWarnings);
  const addEvents            = useDisasterStore((s) => s.addEvents);

  useEffect(() => {
    async function poll() {
      // ── 雷ナウキャスト ──
      const thunder = await fetchJson<{ validtime: string }>('/api/thunder-nowcast');
      if (thunder?.validtime) setThunderTileTime(thunder.validtime);

      // ── 台風 ──
      const typhoonRes = await fetchJson<{ typhoons: TyphoonInfo[] }>('/api/typhoon');
      const typhoons = typhoonRes?.typhoons ?? [];
      setTyphoons(typhoons);

      // 台風イベントをフィードに追加
      const catLabel: Record<string, string> = {
        TY: '台風', STS: '強熱帯暴風', TS: '熱帯暴風', TD: '熱帯低気圧', ET: '温帯低気圧', unknown: '熱帯じょう乱', LOW: '温帯低気圧',
      };
      const typhoonEvents: DisasterEvent[] = typhoons.map((t) => ({
        id: `typhoon-${t.id}`,
        type: 'typhoon',
        severity: t.pressureHPa > 0 && t.pressureHPa < 930 ? 'emergency'
                : t.pressureHPa > 0 && t.pressureHPa < 960 ? 'warning'
                : 'advisory',
        title: `${catLabel[t.category ?? 'unknown'] ?? '台風'} ${t.name}${t.nameEn ? ` (${t.nameEn})` : ''} - ${t.pressureHPa ? `${t.pressureHPa}hPa` : '気圧不明'} / ${t.maxWindKt ? `${t.maxWindKt}kt` : ''}`,
        occurredAt: t.history.at(-1)?.time ?? new Date().toISOString(),
        location: { lat: t.lat, lng: t.lng },
        area: ['西太平洋'],
        raw: t,
        source: 'jma-typhoon',
      }));
      if (typhoonEvents.length > 0) addEvents(typhoonEvents);

      // ── 線状降水帯 ──
      const lpRes = await fetchJson<{ bands: LinearPrecipBand[] }>('/api/linear-precip');
      const bands = lpRes?.bands ?? [];
      setLinearPrecipBands(bands);

      // 線状降水帯イベントをフィードに追加
      const lpEvents: DisasterEvent[] = bands.map((b) => ({
        id: `lp-${b.id}`,
        type: 'linear_precip',
        severity: 'warning',
        title: `線状降水帯 - ${b.area}`,
        occurredAt: b.startedAt,
        area: [b.area],
        raw: b,
        source: 'jma-flood',
      }));
      if (lpEvents.length > 0) addEvents(lpEvents);

      // ── 土砂災害警戒情報 ──
      const lsRes = await fetchJson<{ warnings: LandslideWarning[] }>('/api/landslide');
      const landslideWarnings = lsRes?.warnings ?? [];
      setLandslideWarnings(landslideWarnings);

      // 土砂災害イベントをフィードに追加
      const lsEvents: DisasterEvent[] = landslideWarnings.map((w) => ({
        id: `ls-${w.id}`,
        type: 'landslide',
        severity: w.level === 'emergency' ? 'emergency' : 'warning',
        title: `土砂災害警戒情報 - ${w.prefecture} ${w.area}`,
        occurredAt: w.issuedAt,
        area: [w.prefecture, w.area],
        raw: w,
        source: 'jma-warning',
      }));
      if (lsEvents.length > 0) addEvents(lsEvents);
    }

    poll();
    const id = setInterval(poll, 5 * 60 * 1000); // 5分ごと
    return () => clearInterval(id);
  }, [setThunderTileTime, setTyphoons, setLinearPrecipBands, setLandslideWarnings, addEvents]);
}
