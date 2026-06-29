'use client';

import { useEffect } from 'react';
import { useDisasterStore } from '@/store/useDisasterStore';
import type { TyphoonInfo, LinearPrecipBand, LandslideWarning, DisasterEvent } from './model';

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' });
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
  const replaceEventsByType  = useDisasterStore((s) => s.replaceEventsByType);
  const setLastUpdated       = useDisasterStore((s) => s.setLastUpdated);

  useEffect(() => {
    // ── 雷ナウキャスト（タイルURL更新）──────────────────────────────────
    async function pollThunder() {
      const data = await fetchJson<{ validtime: string }>('/api/thunder-nowcast');
      if (data?.validtime) setThunderTileTime(data.validtime);
    }

    // ── 台風 ────────────────────────────────────────────────────────────
    async function pollTyphoon() {
      const res = await fetchJson<{ typhoons: TyphoonInfo[] }>('/api/typhoon');
      const typhoons = res?.typhoons ?? [];
      setTyphoons(typhoons);

      const catLabel: Record<string, string> = {
        TY: '台風', STS: '強熱帯暴風', TS: '熱帯暴風', TD: '熱帯低気圧',
        ET: '温帯低気圧', unknown: '熱帯じょう乱',
      };
      const typhoonEvents: DisasterEvent[] = typhoons.map((t) => ({
        id: `typhoon-${t.id}`,
        type: 'typhoon',
        severity:
          t.pressureHPa > 0 && t.pressureHPa < 930 ? 'emergency'
          : t.pressureHPa > 0 && t.pressureHPa < 960 ? 'warning'
          : 'advisory',
        title: `${catLabel[t.category ?? 'unknown'] ?? '台風'} ${t.name}${t.nameEn ? ` (${t.nameEn})` : ''} — ${t.pressureHPa ? `${t.pressureHPa}hPa` : '気圧不明'}${t.maxWindKt ? ` / ${t.maxWindKt}kt` : ''}`,
        occurredAt: t.history.at(-1)?.time ?? new Date().toISOString(),
        location: { lat: t.lat, lng: t.lng },
        area: ['西太平洋'],
        raw: t,
        source: 'jma-typhoon',
      }));
      if (typhoonEvents.length > 0) addEvents(typhoonEvents);
    }

    // ── 線状降水帯 ───────────────────────────────────────────────────────
    // 表示ソース: 気象庁（JMA）公式JSON（最速・公式・最信頼）
    // 裏側整合: APIルート内で複数候補→XMLフォールバックを試行し全データを取得
    async function pollLinearPrecip() {
      const res = await fetchJson<{ bands: LinearPrecipBand[]; source?: string }>('/api/linear-precip');
      const bands = res?.bands ?? [];
      setLinearPrecipBands(bands);

      if (bands.length === 0) {
        replaceEventsByType('linear_precip', []);
        return;
      }

      const areas = [...new Set(bands.map((b) => b.area))];
      const areaLabel = areas.slice(0, 3).join('・') + (areas.length > 3 ? `ほか${areas.length - 3}地域` : '');

      const consolidated: DisasterEvent = {
        id: 'linear-precip-active',
        type: 'linear_precip',
        severity: 'warning',
        title: `線状降水帯発生中 — ${areaLabel}`,
        occurredAt: new Date().toISOString(),
        area: areas,
        raw: bands,
        source: res?.source ?? 'jma',
      };
      replaceEventsByType('linear_precip', [consolidated]);
    }

    // ── 土砂災害・大雨・洪水・雷警報（全国47都道府県） ──────────────────
    async function pollLandslide() {
      const res = await fetchJson<{ warnings: LandslideWarning[]; events: DisasterEvent[] }>('/api/landslide');
      if (!res) return;

      setLandslideWarnings(res.warnings ?? []);

      const lsEvents: DisasterEvent[] = (res.warnings ?? []).map((w) => ({
        id: `ls-ev-${w.id}`,
        type: 'landslide' as const,
        severity: w.level === 'emergency' ? 'emergency' : 'warning',
        title: `土砂災害警戒情報 — ${w.prefecture} ${w.area}`,
        occurredAt: w.issuedAt,
        area: [w.prefecture, w.area],
        raw: w,
        source: 'jma-warning',
      }));

      const allEvents = [...lsEvents, ...(res.events ?? [])];
      if (allEvents.length > 0) addEvents(allEvents);
    }

    // ── 津波情報（P2PQuake code 552） ───────────────────────────────────
    async function pollTsunami() {
      const events = await fetchJson<DisasterEvent[]>('/api/tsunami');
      if (events && events.length > 0) addEvents(events);
    }

    // ── まとめて並列実行 ─────────────────────────────────────────────────
    async function pollAll() {
      await Promise.allSettled([
        pollThunder(),
        pollTyphoon(),
        pollLinearPrecip(),
        pollLandslide(),
        pollTsunami(),
      ]);
      setLastUpdated(new Date().toISOString());
    }

    pollAll();
    const id = setInterval(pollAll, 5 * 60 * 1000); // 5分ごと

    // 手動更新ボタンからのイベント
    function handleRefresh() { pollAll(); }
    window.addEventListener('disaster-refresh', handleRefresh);

    return () => {
      clearInterval(id);
      window.removeEventListener('disaster-refresh', handleRefresh);
    };
  }, [setThunderTileTime, setTyphoons, setLinearPrecipBands, setLandslideWarnings, addEvents, replaceEventsByType, setLastUpdated]);
}
