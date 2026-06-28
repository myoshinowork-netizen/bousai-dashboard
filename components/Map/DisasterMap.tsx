'use client';

import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useDisasterStore } from '@/store/useDisasterStore';
import type { DisasterEvent, Severity, TyphoonInfo, TyphoonClassType } from '@/lib/model';

const SEVERITY_COLOR: Record<Severity, string> = {
  info:      '#44445a',
  advisory:  '#ffd600',
  warning:   '#ff6d00',
  emergency: '#ff1744',
};

// タイル URL (GSI 重ねるハザードマップ)
const HAZARD_TILE    = 'https://disaportal.gsi.go.jp/data/raster/01_flood_l2_shinsuishin_data/{z}/{x}/{y}.png';
const FLOOD_TILE     = 'https://disaportal.gsi.go.jp/data/raster/01_flood_l1_shinsuishin_newlegend_data/{z}/{x}/{y}.png';
const LANDSLIDE_TILE = 'https://disaportal.gsi.go.jp/data/raster/05_kyukeishakeikaikuiki/{z}/{x}/{y}.png';

function rainTileUrl(validtime: string) {
  return `https://www.jma.go.jp/bosai/jmatile/data/nowc/${validtime}/none/${validtime}/surf/hrpns/{z}/{x}/{y}.png`;
}
function thunderTileUrl(validtime: string) {
  return `https://www.jma.go.jp/bosai/jmatile/data/thunder/${validtime}/none/${validtime}/surf/thunder/{z}/{x}/{y}.png`;
}

// GeoJSON ヘルパー
function geoCircle(center: [number, number], radiusKm: number, points = 64): GeoJSON.Feature<GeoJSON.Polygon> {
  const [lng, lat] = center;
  const coords: [number, number][] = [];
  for (let i = 0; i <= points; i++) {
    const a = (i / points) * 2 * Math.PI;
    coords.push([
      lng + (radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180))) * Math.sin(a),
      lat + (radiusKm / 111.32) * Math.cos(a),
    ]);
  }
  return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] }, properties: {} };
}

function geoPointOnCircle(center: [number, number], radiusKm: number, angleDeg: number, props: Record<string, unknown> = {}): GeoJSON.Feature<GeoJSON.Point> {
  const [lng, lat] = center;
  const a = (angleDeg * Math.PI) / 180;
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [
      lng + (radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180))) * Math.sin(a),
      lat + (radiusKm / 111.32) * Math.cos(a),
    ] },
    properties: props,
  };
}

// カテゴリ別カラー
const TC_CLASS_COLOR: Record<TyphoonClassType, string> = {
  TY:      '#ff1744', // 赤（台風）
  STS:     '#ff6d00', // 橙
  TS:      '#e040fb', // 紫（熱帯暴風）
  TD:      '#78909c', // グレー（熱帯低気圧）
  ET:      '#546e7a', // 濃グレー（温帯低気圧）
  unknown: '#455a64',
};

// 台風トラック → GeoJSON
// 2点間の線形補間（時刻ベース）
function interpolatePos(
  p1: { lat: number; lng: number; time: string },
  p2: { lat: number; lng: number; time: string },
  targetMs: number,
): { lat: number; lng: number } {
  const t1 = new Date(p1.time).getTime();
  const t2 = new Date(p2.time).getTime();
  if (t2 === t1) return { lat: p1.lat, lng: p1.lng };
  const ratio = Math.max(0, Math.min(1, (targetMs - t1) / (t2 - t1)));
  return {
    lat: p1.lat + (p2.lat - p1.lat) * ratio,
    lng: p1.lng + (p2.lng - p1.lng) * ratio,
  };
}

function typhoonToGeoJSON(typhoons: TyphoonInfo[], selectedTime: number | null): {
  positions: GeoJSON.FeatureCollection;
  tracks: GeoJSON.FeatureCollection;
  windCircles: GeoJSON.FeatureCollection;
  historyLines: GeoJSON.FeatureCollection;
  historyDots: GeoJSON.FeatureCollection;
} {
  const positions: GeoJSON.Feature[]    = [];
  const tracks: GeoJSON.Feature[]       = [];
  const windCircles: GeoJSON.Feature[]  = [];
  const historyLines: GeoJSON.Feature[] = [];
  const historyDots: GeoJSON.Feature[]  = [];

  for (const tc of typhoons) {
    // ── selectedTime に基づいて表示位置・トラックを決定 ──
    let dispLat = tc.lat;
    let dispLng = tc.lng;
    let dispWindKt = tc.maxWindKt;

    // 全時刻ポイントをマージ（過去→現在→予報の順）
    const allPoints: Array<{ lat: number; lng: number; time: string; forecast: boolean }> = [
      ...(tc.history ?? []).map((h) => ({ lat: h.lat, lng: h.lng, time: h.time, forecast: false })),
      { lat: tc.lat, lng: tc.lng, time: new Date().toISOString(), forecast: false },
      ...(tc.track ?? []).map((t) => ({ lat: t.lat, lng: t.lng, time: t.time, forecast: true })),
    ].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

    if (selectedTime !== null && allPoints.length >= 2) {
      const target = selectedTime;
      // selectedTime より前の最後のポイントと後の最初のポイントを探す
      let beforeIdx = -1;
      for (let i = allPoints.length - 1; i >= 0; i--) {
        if (new Date(allPoints[i].time).getTime() <= target) { beforeIdx = i; break; }
      }
      const afterIdx = allPoints.findIndex((p) => new Date(p.time).getTime() >= target);

      if (beforeIdx === -1) {
        // selectedTime が全履歴より前 → 台風はまだ存在しない
        continue;
      } else if (afterIdx === -1) {
        // selectedTime が全予報より後 → 最後の位置に固定
        const last = allPoints[allPoints.length - 1];
        dispLat = last.lat;
        dispLng = last.lng;
      } else if (beforeIdx === afterIdx) {
        // ちょうど一致
        dispLat = allPoints[beforeIdx].lat;
        dispLng = allPoints[beforeIdx].lng;
      } else {
        // 補間
        const pos = interpolatePos(allPoints[beforeIdx], allPoints[afterIdx], target);
        dispLat = pos.lat;
        dispLng = pos.lng;
      }
    }

    // 現在位置（または補間位置）
    positions.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [dispLng, dispLat] },
      properties: {
        name:     tc.name,
        pressure: tc.pressureHPa,
        color:    TC_CLASS_COLOR[tc.category ?? 'unknown'],
      },
    });

    // 予報トラック（破線）: ライブ or 未来選択時のみ
    if (selectedTime === null || selectedTime >= Date.now()) {
      const forecastCoords: [number, number][] = [
        [dispLng, dispLat],
        ...(tc.track ?? [])
          .filter((p) => selectedTime === null || new Date(p.time).getTime() >= selectedTime)
          .map((p) => [p.lng, p.lat] as [number, number]),
      ];
      if (forecastCoords.length > 1) {
        tracks.push({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: forecastCoords },
          properties: { name: tc.name },
        });
      }
    }

    // 暴風域（最大風速から概算）
    if (dispWindKt > 34) {
      const windRadiusKm = Math.min(dispWindKt * 1.5, 300);
      windCircles.push(geoCircle([dispLng, dispLat], windRadiusKm, 64));
    }

    // ── 過去トラック履歴 ──
    // selectedTime がある場合はその時刻までの履歴のみ表示
    const histFiltered = (tc.history ?? []).filter(
      (p) => selectedTime === null || new Date(p.time).getTime() <= selectedTime
    );

    if (histFiltered.length > 0) {
      const histCoords: [number, number][] = histFiltered.map((p) => [p.lng, p.lat]);
      histCoords.push([dispLng, dispLat]);
      if (histCoords.length > 1) {
        historyLines.push({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: histCoords },
          properties: { name: tc.name },
        });
      }

      for (const pt of histFiltered) {
        const color = TC_CLASS_COLOR[pt.classType];
        const labelText = pt.classType === 'ET'  ? '温低' :
                          pt.classType === 'TD'  ? '熱低' :
                          pt.classType === 'STS' ? '強熱' :
                          pt.classType === 'TY'  ? '台風' :
                          pt.classType === 'TS'  ? '熱嵐' : '';
        historyDots.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [pt.lng, pt.lat] },
          properties: {
            color,
            label: labelText,
            time:  pt.time,
            pressure: pt.pressureHPa ?? '',
          },
        });
      }
    }
  }

  return {
    positions:    { type: 'FeatureCollection', features: positions },
    tracks:       { type: 'FeatureCollection', features: tracks },
    windCircles:  { type: 'FeatureCollection', features: windCircles },
    historyLines: { type: 'FeatureCollection', features: historyLines },
    historyDots:  { type: 'FeatureCollection', features: historyDots },
  };
}

const EMPTY_FC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
const P_WAVE_KMS   = 6.0;
const S_WAVE_KMS   = 3.5;
const REALTIME_MS  = 3 * 60 * 1000;
const REPLAY_CYCLE_MS = 90000;   // リプレイ1サイクル 90秒（旧25秒）
const REPLAY_MAX_SEC  = 180;     // 最大180秒分の波を表示（2倍速で再生）

function parseMagnitude(title: string): number {
  const m = title.match(/M\s*(\d+(?:\.\d+)?)/i);
  return m ? parseFloat(m[1]) : 3.0;
}
function shakeDurationMs(magnitude: number): number {
  return Math.min(Math.pow(10, (magnitude - 1.5) / 2) * 1500, 120000);
}
function shakingZoneRadii(mag: number): [number, number, number] {
  const inner  = Math.max(5,   Math.min(18 * Math.pow(10, (mag - 4) * 0.7), 150));
  const middle = Math.min(inner * 2.5, 350);
  const outer  = Math.min(inner * 5.0, 600);
  return [inner, middle, outer];
}
function waveArrivalLabel(occurredAtMs: number, radiusKm: number, speedKmPerSec: number): string {
  if (radiusKm < 2) return '';
  const t = new Date(occurredAtMs + (radiusKm / speedKmPerSec) * 1000);
  return t.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function initAllLayers(map: maplibregl.Map) {
  const e = EMPTY_FC;

  // ── ハザード・降水タイル ──
  map.addSource('hazard_max',   { type: 'raster', tiles: [HAZARD_TILE],    tileSize: 256, maxzoom: 17 });
  map.addSource('hazard_plan',  { type: 'raster', tiles: [FLOOD_TILE],     tileSize: 256, maxzoom: 17 });
  map.addSource('rain_nowcast', { type: 'raster', tiles: [], tileSize: 256, maxzoom: 10 });
  map.addLayer({ id: 'hazard-max',  type: 'raster', source: 'hazard_max',  paint: { 'raster-opacity': 0.6 }, layout: { visibility: 'none' } });
  map.addLayer({ id: 'hazard-plan', type: 'raster', source: 'hazard_plan', paint: { 'raster-opacity': 0.5 }, layout: { visibility: 'none' } });
  map.addLayer({ id: 'rain',        type: 'raster', source: 'rain_nowcast',paint: { 'raster-opacity': 0.7 }, layout: { visibility: 'none' } });

  // ── 雷ナウキャスト ──
  map.addSource('thunder_nowcast', { type: 'raster', tiles: [], tileSize: 256, maxzoom: 10 });
  map.addLayer({ id: 'thunder', type: 'raster', source: 'thunder_nowcast',
    paint: { 'raster-opacity': 0.75 }, layout: { visibility: 'none' } });

  // ── 土砂災害危険箇所（GSI）──
  map.addSource('landslide_hazard', { type: 'raster', tiles: [LANDSLIDE_TILE], tileSize: 256, maxzoom: 17 });
  map.addLayer({ id: 'landslide', type: 'raster', source: 'landslide_hazard',
    paint: { 'raster-opacity': 0.6 }, layout: { visibility: 'none' } });

  // ── 台風 ──
  // 過去トラック実線
  map.addSource('typhoon-history-line', { type: 'geojson', data: e });
  map.addLayer({ id: 'typhoon-history-line', type: 'line', source: 'typhoon-history-line',
    paint: { 'line-color': '#e040fb', 'line-width': 2, 'line-opacity': 0.6 }, layout: { visibility: 'none' } });

  // 過去トラック点（カテゴリ別色）
  map.addSource('typhoon-history-dots', { type: 'geojson', data: e });
  map.addLayer({ id: 'typhoon-history-dots', type: 'circle', source: 'typhoon-history-dots',
    paint: {
      'circle-color': ['get', 'color'],
      'circle-radius': 5,
      'circle-stroke-color': '#05050a',
      'circle-stroke-width': 1.5,
      'circle-opacity': 0.9,
    }, layout: { visibility: 'none' } });
  map.addLayer({ id: 'typhoon-history-label', type: 'symbol', source: 'typhoon-history-dots',
    layout: {
      'text-field': ['get', 'label'],
      'text-font': ['DotGothic16 Regular'],
      'text-size': 8,
      'text-anchor': 'top',
      'text-offset': [0, 0.8],
      'visibility': 'none',
    },
    paint: { 'text-color': ['get', 'color'], 'text-halo-color': '#05050a', 'text-halo-width': 1.5 },
  });

  // 暴風域
  map.addSource('typhoon-wind',  { type: 'geojson', data: e });
  map.addLayer({ id: 'typhoon-wind-fill', type: 'fill', source: 'typhoon-wind',
    paint: { 'fill-color': '#e040fb', 'fill-opacity': 0.06 }, layout: { visibility: 'none' } });
  map.addLayer({ id: 'typhoon-wind-line', type: 'line', source: 'typhoon-wind',
    paint: { 'line-color': '#e040fb', 'line-width': 1.5, 'line-opacity': 0.55, 'line-dasharray': [4, 3] }, layout: { visibility: 'none' } });

  // 予報トラック（破線）
  map.addSource('typhoon-track', { type: 'geojson', data: e });
  map.addLayer({ id: 'typhoon-track-line', type: 'line', source: 'typhoon-track',
    paint: { 'line-color': '#e040fb', 'line-width': 2, 'line-opacity': 0.85, 'line-dasharray': [6, 3] }, layout: { visibility: 'none' } });

  // 現在位置マーカー
  map.addSource('typhoon-pos', { type: 'geojson', data: e });
  map.addLayer({ id: 'typhoon-pos-outer', type: 'circle', source: 'typhoon-pos',
    paint: { 'circle-color': 'transparent', 'circle-stroke-color': ['get', 'color'], 'circle-stroke-width': 2, 'circle-radius': 14, 'circle-opacity': 0.8 }, layout: { visibility: 'none' } });
  map.addLayer({ id: 'typhoon-pos-inner', type: 'circle', source: 'typhoon-pos',
    paint: { 'circle-color': ['get', 'color'], 'circle-radius': 6, 'circle-opacity': 1.0 }, layout: { visibility: 'none' } });
  map.addLayer({ id: 'typhoon-label', type: 'symbol', source: 'typhoon-pos',
    layout: {
      'text-field': ['concat', '台風\n', ['get', 'name']],
      'text-font': ['DotGothic16 Regular'],
      'text-size': 10,
      'text-anchor': 'top',
      'text-offset': [0, 1.5],
      'visibility': 'none',
    },
    paint: { 'text-color': '#e040fb', 'text-halo-color': '#05050a', 'text-halo-width': 2 },
  });

  // ── 地震波・震動圏ゾーン ──
  const zones: [string, string, number, number, number[] | null][] = [
    ['eq-zone-outer',  '#ffd600', 0.03, 0.40, [4, 6]],
    ['eq-zone-middle', '#ff6d00', 0.06, 0.60, [6, 4]],
    ['eq-zone-inner',  '#ff1744', 0.12, 0.85, null],
  ];
  for (const [id, color, fillOp, lineOp, dash] of zones) {
    map.addSource(id, { type: 'geojson', data: e });
    map.addLayer({ id: `${id}-fill`, type: 'fill', source: id, paint: { 'fill-color': color, 'fill-opacity': fillOp } });
    map.addLayer({ id: `${id}-line`, type: 'line', source: id,
      paint: { 'line-color': color, 'line-width': 1.5, 'line-opacity': lineOp, ...(dash ? { 'line-dasharray': dash } : {}) } });
  }

  map.addSource('eq-p-wave', { type: 'geojson', data: e });
  map.addLayer({ id: 'eq-p-wave-line', type: 'line', source: 'eq-p-wave',
    paint: { 'line-color': '#00e5ff', 'line-width': 2.5, 'line-opacity': 0, 'line-blur': 2 } });

  map.addSource('eq-s-wave', { type: 'geojson', data: e });
  map.addLayer({ id: 'eq-s-wave-line', type: 'line', source: 'eq-s-wave',
    paint: { 'line-color': '#ff6060', 'line-width': 3.5, 'line-opacity': 0, 'line-blur': 3 } });

  map.addSource('eq-p-label', { type: 'geojson', data: e });
  map.addLayer({ id: 'eq-p-label-sym', type: 'symbol', source: 'eq-p-label',
    layout: { 'text-field': ['get', 'label'], 'text-font': ['DotGothic16 Regular'], 'text-size': 10, 'text-anchor': 'left', 'text-offset': [0.6, 0] },
    paint: { 'text-color': '#00e5ff', 'text-halo-color': '#05050a', 'text-halo-width': 2, 'text-opacity': 0 } });

  map.addSource('eq-s-label', { type: 'geojson', data: e });
  map.addLayer({ id: 'eq-s-label-sym', type: 'symbol', source: 'eq-s-label',
    layout: { 'text-field': ['get', 'label'], 'text-font': ['DotGothic16 Regular'], 'text-size': 10, 'text-anchor': 'left', 'text-offset': [0.6, 0] },
    paint: { 'text-color': '#ff6060', 'text-halo-color': '#05050a', 'text-halo-width': 2, 'text-opacity': 0 } });
}

export function DisasterMap() {
  const mapRef            = useRef<maplibregl.Map | null>(null);
  const containerRef      = useRef<HTMLDivElement>(null);
  const markersRef        = useRef<maplibregl.Marker[]>([]);
  const tsunamiMarkersRef = useRef<maplibregl.Marker[]>([]);
  const waveRafRef        = useRef<number | null>(null);
  const locationMarkerRef = useRef<maplibregl.Marker | null>(null);
  const geoWatchRef       = useRef<number | null>(null);
  const shouldFlyRef      = useRef(false); // ボタン押下時のみtrue→flyTo後false
  const [geoStatus, setGeoStatus] = useState<'idle' | 'loading' | 'active' | 'denied'>('idle');
  const [showDeniedTooltip, setShowDeniedTooltip] = useState(false);
  const [deniedFading, setDeniedFading] = useState(false);
  const deniedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const events           = useDisasterStore((s) => s.events);
  const selectedEvent    = useDisasterStore((s) => s.selectedEvent);
  const selectEvent      = useDisasterStore((s) => s.selectEvent);
  const layers           = useDisasterStore((s) => s.layers);
  const rainTileTime     = useDisasterStore((s) => s.rainTileTime);
  const thunderTileTime  = useDisasterStore((s) => s.thunderTileTime);
  const rainTileHistory  = useDisasterStore((s) => s.rainTileHistory);
  const typhoons         = useDisasterStore((s) => s.typhoons);
  const selectedTime     = useDisasterStore((s) => s.selectedTime);
  const setRainTileTime  = useDisasterStore((s) => s.setRainTileTime);
  const setRainTileHistory = useDisasterStore((s) => s.setRainTileHistory);
  const userLocation     = useDisasterStore((s) => s.userLocation);
  const setUserLocation  = useDisasterStore((s) => s.setUserLocation);

  // 降水ナウキャスト validtime + 履歴 取得
  useEffect(() => {
    async function fetchTime() {
      try {
        const [latest, history] = await Promise.all([
          fetch('/api/jma-nowcast').then((r) => r.json()).catch(() => null),
          fetch('/api/rain-history').then((r) => r.json()).catch(() => null),
        ]);
        if (latest?.validtime) setRainTileTime(latest.validtime);
        if (history?.validtimes) setRainTileHistory(history.validtimes);
      } catch { /* ignore */ }
    }
    fetchTime();
    const id = setInterval(fetchTime, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [setRainTileTime, setRainTileHistory]);

  // 地図初期化
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: '/api/dark-style',
      center: [136.5, 35.5],
      zoom: 5,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    let unsubTyphoon: (() => void) | null = null;

    map.once('style.load', () => {
      initAllLayers(map);

      // style.load 時点で rainTileTime が取得済みであればすぐ反映（非同期ポーリングより先に来ることがある）
      const initRainTime = useDisasterStore.getState().rainTileTime;
      if (initRainTime) {
        const rainSrc = map.getSource('rain_nowcast') as maplibregl.RasterTileSource | undefined;
        if (rainSrc) rainSrc.setTiles([rainTileUrl(initRainTime)]);
      }
      const initThunderTime = useDisasterStore.getState().thunderTileTime;
      if (initThunderTime) {
        const thunderSrc = map.getSource('thunder_nowcast') as maplibregl.RasterTileSource | undefined;
        if (thunderSrc) thunderSrc.setTiles([thunderTileUrl(initThunderTime)]);
      }

      // 台風データを地図ソースに反映するヘルパー（selectedTimeはstoreから毎回取得）
      function applyTyphoons(tcs: TyphoonInfo[]) {
        if (!map.getSource('typhoon-pos')) return;
        const selTime = useDisasterStore.getState().selectedTime;
        const { positions, tracks, windCircles, historyLines, historyDots } = typhoonToGeoJSON(tcs, selTime);
        (map.getSource('typhoon-pos')          as maplibregl.GeoJSONSource).setData(positions);
        (map.getSource('typhoon-track')        as maplibregl.GeoJSONSource).setData(tracks);
        (map.getSource('typhoon-wind')         as maplibregl.GeoJSONSource).setData(windCircles);
        (map.getSource('typhoon-history-line') as maplibregl.GeoJSONSource).setData(historyLines);
        (map.getSource('typhoon-history-dots') as maplibregl.GeoJSONSource).setData(historyDots);
      }

      // 現在の台風データを即時反映
      applyTyphoons(useDisasterStore.getState().typhoons);

      // Zustand store を直接 subscribe して台風データ・selectedTime 変化を追跡
      let prevTyphoons    = useDisasterStore.getState().typhoons;
      let prevSelectedTime = useDisasterStore.getState().selectedTime;
      unsubTyphoon = useDisasterStore.subscribe((state) => {
        if (state.typhoons !== prevTyphoons || state.selectedTime !== prevSelectedTime) {
          prevTyphoons    = state.typhoons;
          prevSelectedTime = state.selectedTime;
          applyTyphoons(state.typhoons);
        }
      });
    });

    return () => {
      unsubTyphoon?.();
      if (waveRafRef.current) cancelAnimationFrame(waveRafRef.current);
      if (geoWatchRef.current !== null) navigator.geolocation?.clearWatch(geoWatchRef.current);
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // レイヤー ON/OFF（全種別）
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const vis = (id: string, on: boolean) => {
        if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
      };
      vis('hazard-max',         layers.hazard);
      vis('hazard-plan',        layers.hazard);
      vis('rain',               layers.rain);
      vis('thunder',            layers.thunder);
      vis('landslide',          layers.landslide);
      vis('typhoon-history-line',  layers.typhoon);
      vis('typhoon-history-dots',  layers.typhoon);
      vis('typhoon-history-label', layers.typhoon);
      vis('typhoon-wind-fill',     layers.typhoon);
      vis('typhoon-wind-line',     layers.typhoon);
      vis('typhoon-track-line',    layers.typhoon);
      vis('typhoon-pos-outer',     layers.typhoon);
      vis('typhoon-pos-inner',     layers.typhoon);
      vis('typhoon-label',         layers.typhoon);
      // 線状降水帯はONのとき降水タイルも同時に有効化
      if (layers.linearPrecip) vis('rain', true);
    };
    if (map.isStyleLoaded()) apply(); else map.once('style.load', apply);
  }, [layers]);

  // 降水タイル URL 更新（タイムライン対応）
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    // タイムラインが設定されていれば最近傍の履歴タイルを選択
    let tileTime: string | null = rainTileTime;
    if (selectedTime !== null && rainTileHistory.length > 0) {
      // validtime 形式: "YYYYMMDDHHMMSS" → Date に変換して最近傍を探す
      const target = selectedTime;
      let best: string | null = null;
      let bestDiff = Infinity;
      for (const vt of rainTileHistory) {
        const y = +vt.slice(0,4), mo = +vt.slice(4,6)-1, d = +vt.slice(6,8);
        const h = +vt.slice(8,10), mi = +vt.slice(10,12), s = +vt.slice(12,14);
        const t = new Date(y,mo,d,h,mi,s).getTime();
        const diff = Math.abs(t - target);
        if (diff < bestDiff) { bestDiff = diff; best = vt; }
      }
      tileTime = best;
    }

    if (!tileTime) return;
    const src = map.getSource('rain_nowcast') as maplibregl.RasterTileSource | undefined;
    if (src) src.setTiles([rainTileUrl(tileTime)]);
  }, [rainTileTime, rainTileHistory, selectedTime]);

  // 雷タイル URL 更新
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !thunderTileTime || !map.isStyleLoaded()) return;
    const apply = () => {
      const src = map.getSource('thunder_nowcast') as maplibregl.RasterTileSource | undefined;
      if (src) src.setTiles([thunderTileUrl(thunderTileTime)]);
    };
    if (map.isStyleLoaded()) apply(); else map.once('style.load', apply);
  }, [thunderTileTime]);

  // 台風 GeoJSON 更新（typhoons または selectedTime が変わったとき）
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      if (!map.getSource('typhoon-pos')) return;
      const { positions, tracks, windCircles, historyLines, historyDots } = typhoonToGeoJSON(typhoons, selectedTime);
      (map.getSource('typhoon-pos')          as maplibregl.GeoJSONSource).setData(positions);
      (map.getSource('typhoon-track')        as maplibregl.GeoJSONSource).setData(tracks);
      (map.getSource('typhoon-wind')         as maplibregl.GeoJSONSource).setData(windCircles);
      (map.getSource('typhoon-history-line') as maplibregl.GeoJSONSource).setData(historyLines);
      (map.getSource('typhoon-history-dots') as maplibregl.GeoJSONSource).setData(historyDots);
    };
    if (map.isStyleLoaded()) apply(); else map.once('style.load', apply);
  }, [typhoons, selectedTime]);

  // 地震マーカー更新
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    if (!layers.earthquake) return;

    const eqEvents = events.filter((e) => e.type === 'earthquake');
    eqEvents.forEach((event: DisasterEvent) => {
      if (!event.location) return;
      const color = SEVERITY_COLOR[event.severity];
      const isEmergency = event.severity === 'emergency';
      const size = isEmergency ? 16 : 10;
      const el = document.createElement('div');
      el.style.cssText = `width:${size}px;height:${size}px;border-radius:50%;background:${color};border:1px solid ${color};cursor:pointer;box-shadow:0 0 ${isEmergency?12:6}px ${color};${isEmergency?'animation:cp-pulse 1s ease-in-out infinite;':''}`;
      el.addEventListener('click', () => selectEvent(event));
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([event.location!.lng, event.location!.lat])
        .setPopup(new maplibregl.Popup({ offset: 14 }).setHTML(
          `<div style="color:#ff1744;font-weight:bold;margin-bottom:4px">${event.title}</div>
           <div style="color:#888;font-size:11px">${new Date(event.occurredAt).toLocaleString('ja-JP')}</div>
           ${event.area ? `<div style="color:#aaa;font-size:11px;margin-top:4px">${event.area.slice(0,3).join(' / ')}</div>` : ''}`
        ))
        .addTo(map);
      markersRef.current.push(marker);
    });
  }, [events, layers.earthquake, selectEvent]);

  // 津波マーカー更新
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    tsunamiMarkersRef.current.forEach((m) => m.remove());
    tsunamiMarkersRef.current = [];
    if (!layers.tsunami) return;

    const tsunamiEvents = events.filter((e) => e.type === 'tsunami');
    tsunamiEvents.forEach((event: DisasterEvent) => {
      if (!event.location) return;
      const isEmergency = event.severity === 'emergency';
      const size = isEmergency ? 18 : 12;
      const el = document.createElement('div');
      el.innerHTML = '🌊';
      el.style.cssText = `font-size:${size}px;cursor:pointer;filter:drop-shadow(0 0 ${isEmergency ? 8 : 4}px #00b0ff);${isEmergency ? 'animation:cp-pulse 1s ease-in-out infinite;' : ''}`;
      el.addEventListener('click', () => selectEvent(event));
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([event.location!.lng, event.location!.lat])
        .setPopup(new maplibregl.Popup({ offset: 14 }).setHTML(
          `<div style="color:#00b0ff;font-weight:bold;margin-bottom:4px">${event.title}</div>
           <div style="color:#888;font-size:11px">${new Date(event.occurredAt).toLocaleString('ja-JP')}</div>
           ${event.area ? `<div style="color:#aaa;font-size:11px;margin-top:4px">${event.area.slice(0,3).join(' / ')}</div>` : ''}`
        ))
        .addTo(map);
      tsunamiMarkersRef.current.push(marker);
    });
  }, [events, layers.tsunami, selectEvent]);

  // 選択イベント → 波・震動圏アニメーション
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    if (waveRafRef.current) { cancelAnimationFrame(waveRafRef.current); waveRafRef.current = null; }

    const event = selectedEvent;
    if (!event?.location || event.type !== 'earthquake') {
      const ids = ['eq-zone-outer','eq-zone-middle','eq-zone-inner','eq-p-wave','eq-s-wave','eq-p-label','eq-s-label'];
      ids.forEach((id) => (map.getSource(id) as maplibregl.GeoJSONSource | undefined)?.setData(EMPTY_FC));
      return;
    }

    const center: [number, number] = [event.location.lng, event.location.lat];
    map.flyTo({ center, zoom: 7, speed: 1.2 });

    const mag        = parseMagnitude(event.title);
    const shakeDur   = shakeDurationMs(mag);
    const occurredMs = new Date(event.occurredAt).getTime();
    const [rInner, rMiddle, rOuter] = shakingZoneRadii(mag);
    const shakeColor = SEVERITY_COLOR[event.severity];

    const waitForLayers = () => {
      if (!map.getSource('eq-zone-inner')) { setTimeout(waitForLayers, 200); return; }

      (map.getSource('eq-zone-inner')  as maplibregl.GeoJSONSource).setData({ type:'FeatureCollection', features:[geoCircle(center, rInner)] });
      (map.getSource('eq-zone-middle') as maplibregl.GeoJSONSource).setData({ type:'FeatureCollection', features:[geoCircle(center, rMiddle)] });
      (map.getSource('eq-zone-outer')  as maplibregl.GeoJSONSource).setData({ type:'FeatureCollection', features:[geoCircle(center, rOuter)] });
      map.setPaintProperty('eq-zone-inner-fill', 'fill-color', shakeColor);
      map.setPaintProperty('eq-zone-inner-line', 'line-color', shakeColor);

      const rafStart = performance.now();
      let lastLabelSec = -1; // ラベル更新を1秒ごとに抑制
      const animate = () => {
        if (!mapRef.current) return;
        const elapsed = performance.now() - rafStart;
        const realElapsedMs = Date.now() - occurredMs;
        const isShaking = realElapsedMs < shakeDur;

        if (isShaking) {
          const pulse = 0.5 + 0.5 * Math.sin((elapsed / 400) * Math.PI * 2);
          map.setPaintProperty('eq-zone-inner-fill',  'fill-opacity',  0.06 + 0.18 * pulse);
          map.setPaintProperty('eq-zone-inner-line',  'line-opacity',  0.55 + 0.45 * pulse);
          map.setPaintProperty('eq-zone-middle-fill', 'fill-opacity',  0.04 + 0.10 * pulse);
          map.setPaintProperty('eq-zone-middle-line', 'line-opacity',  0.35 + 0.30 * pulse);
          map.setPaintProperty('eq-zone-outer-fill',  'fill-opacity',  0.02 + 0.05 * pulse);
          map.setPaintProperty('eq-zone-outer-line',  'line-opacity',  0.20 + 0.20 * pulse);
        } else {
          map.setPaintProperty('eq-zone-inner-fill',  'fill-opacity', 0.04);
          map.setPaintProperty('eq-zone-inner-line',  'line-opacity', 0.30);
          map.setPaintProperty('eq-zone-middle-fill', 'fill-opacity', 0.02);
          map.setPaintProperty('eq-zone-middle-line', 'line-opacity', 0.20);
          map.setPaintProperty('eq-zone-outer-fill',  'fill-opacity', 0.01);
          map.setPaintProperty('eq-zone-outer-line',  'line-opacity', 0.12);
        }

        const isRealtime = realElapsedMs < REALTIME_MS;
        let pR: number, sR: number, pOp: number, sOp: number, pW: number, sW: number;

        if (isRealtime) {
          const secFromQuake = realElapsedMs / 1000;
          pR = secFromQuake * P_WAVE_KMS;
          sR = Math.max(0, secFromQuake * S_WAVE_KMS);
          pOp = 0.85; sOp = sR > 2 ? 0.75 : 0;
          pW = 3; sW = 4.5;
        } else {
          const replayT   = (elapsed % REPLAY_CYCLE_MS) / REPLAY_CYCLE_MS;
          const replaySec = replayT * REPLAY_MAX_SEC;
          pR  = replaySec * P_WAVE_KMS;
          sR  = Math.max(0, (replaySec - 5) * S_WAVE_KMS);
          pOp = Math.max(0, (1 - replayT * 1.15) * 0.85);
          sOp = Math.max(0, sR > 2 ? (1 - replayT * 1.2) * 0.75 : 0);
          pW  = Math.max(1.5, 3.5 * (1 - replayT * 0.8));
          sW  = Math.max(2,   5.0 * (1 - replayT * 0.8));
        }

        const pSrc = map.getSource('eq-p-wave') as maplibregl.GeoJSONSource | undefined;
        const pLblSrc = map.getSource('eq-p-label') as maplibregl.GeoJSONSource | undefined;
        if (pSrc && pR > 1) {
          pSrc.setData({ type:'FeatureCollection', features:[geoCircle(center, pR, 128)] });
          map.setPaintProperty('eq-p-wave-line', 'line-opacity', pOp);
          map.setPaintProperty('eq-p-wave-line', 'line-width',   pW);
        }
        // ラベルは1秒ごとのみ更新（毎フレームsetDataすると点滅する）
        const currentSec = Math.floor(elapsed / 1000);
        const shouldUpdateLabel = currentSec !== lastLabelSec;
        if (shouldUpdateLabel) lastLabelSec = currentSec;

        if (pLblSrc && pR > 5 && pOp > 0.05) {
          if (shouldUpdateLabel) {
            pLblSrc.setData({ type:'FeatureCollection', features:[geoPointOnCircle(center, pR, 45, { label: `P波 ${waveArrivalLabel(occurredMs, pR, P_WAVE_KMS)}` })] });
          }
          map.setPaintProperty('eq-p-label-sym', 'text-opacity', Math.min(pOp * 1.2, 1));
        } else if (pLblSrc && pOp <= 0.05) {
          if (shouldUpdateLabel) pLblSrc.setData(EMPTY_FC);
        }

        const sSrc = map.getSource('eq-s-wave') as maplibregl.GeoJSONSource | undefined;
        const sLblSrc = map.getSource('eq-s-label') as maplibregl.GeoJSONSource | undefined;
        if (sSrc && sR > 1) {
          sSrc.setData({ type:'FeatureCollection', features:[geoCircle(center, sR, 128)] });
          map.setPaintProperty('eq-s-wave-line', 'line-opacity', sOp);
          map.setPaintProperty('eq-s-wave-line', 'line-width',   sW);
        }
        if (sLblSrc && sR > 5 && sOp > 0.05) {
          if (shouldUpdateLabel) {
            sLblSrc.setData({ type:'FeatureCollection', features:[geoPointOnCircle(center, sR, 60, { label: `S波 ${waveArrivalLabel(occurredMs, sR, S_WAVE_KMS)}` })] });
          }
          map.setPaintProperty('eq-s-label-sym', 'text-opacity', Math.min(sOp * 1.2, 1));
        } else if (sLblSrc && sOp <= 0.05) {
          if (shouldUpdateLabel) sLblSrc.setData(EMPTY_FC);
        }

        waveRafRef.current = requestAnimationFrame(animate);
      };
      waveRafRef.current = requestAnimationFrame(animate);
    };
    waitForLayers();
  }, [selectedEvent]);

  // 現在地マーカー + 精度円
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const apply = () => {
      // 精度円 (GeoJSON circle)
      if (!map.getSource('user-accuracy')) {
        map.addSource('user-accuracy', { type: 'geojson', data: EMPTY_FC });
        map.addLayer({ id: 'user-accuracy-fill', type: 'fill', source: 'user-accuracy',
          paint: { 'fill-color': '#00e5ff', 'fill-opacity': 0.08 } });
        map.addLayer({ id: 'user-accuracy-line', type: 'line', source: 'user-accuracy',
          paint: { 'line-color': '#00e5ff', 'line-width': 1.5, 'line-opacity': 0.5, 'line-dasharray': [4, 3] } });
      }

      if (!userLocation) {
        (map.getSource('user-accuracy') as maplibregl.GeoJSONSource | undefined)?.setData(EMPTY_FC);
        locationMarkerRef.current?.remove();
        locationMarkerRef.current = null;
        return;
      }

      const { lat, lng, accuracy } = userLocation;
      const accuracyKm = accuracy / 1000;

      // 精度円を更新
      const src = map.getSource('user-accuracy') as maplibregl.GeoJSONSource | undefined;
      if (src && accuracyKm > 0.05) {
        src.setData({ type: 'FeatureCollection', features: [geoCircle([lng, lat], accuracyKm)] });
      }

      // マーカー作成/移動
      if (!locationMarkerRef.current) {
        const el = document.createElement('div');
        el.style.cssText = [
          'width:16px', 'height:16px', 'border-radius:50%',
          'background:#00e5ff', 'border:2px solid #fff',
          'box-shadow:0 0 12px #00e5ff, 0 0 4px #fff',
          'position:relative',
        ].join(';');
        // パルスリング
        const ring = document.createElement('div');
        ring.style.cssText = [
          'position:absolute', 'inset:-8px', 'border-radius:50%',
          'border:2px solid rgba(0,229,255,0.5)',
          'animation:cp-pulse 1.5s ease-in-out infinite',
        ].join(';');
        el.appendChild(ring);
        locationMarkerRef.current = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([lng, lat])
          .addTo(map);
      } else {
        locationMarkerRef.current.setLngLat([lng, lat]);
      }
    };

    if (map.isStyleLoaded()) apply(); else map.once('style.load', apply);
  }, [userLocation]);

  // denied ツールチップをフェードアウトして消去
  function hideDenied() {
    if (deniedTimerRef.current) clearTimeout(deniedTimerRef.current);
    setDeniedFading(true);
    deniedTimerRef.current = setTimeout(() => {
      setShowDeniedTooltip(false);
      setDeniedFading(false);
    }, 600);
  }

  // denied ツールチップを表示し 4 秒後に自動消去
  function showDenied() {
    if (deniedTimerRef.current) clearTimeout(deniedTimerRef.current);
    setDeniedFading(false);
    setShowDeniedTooltip(true);
    deniedTimerRef.current = setTimeout(() => hideDenied(), 4000);
  }

  // 現在地取得関数
  function requestGeolocation() {
    if (!navigator.geolocation) {
      setGeoStatus('denied');
      showDenied();
      return;
    }
    // denied 状態ならツールチップ表示をトグル
    if (geoStatus === 'denied') {
      if (showDeniedTooltip) {
        hideDenied();
      } else {
        showDenied();
      }
      return;
    }

    setGeoStatus('loading');
    shouldFlyRef.current = true; // 次の位置取得でflyTo

    const handlePos = (pos: GeolocationPosition) => {
      const { latitude: lat, longitude: lng, accuracy } = pos.coords;
      setUserLocation({ lat, lng, accuracy });
      setGeoStatus('active');
      if (shouldFlyRef.current) {
        shouldFlyRef.current = false;
        mapRef.current?.flyTo({ center: [lng, lat], zoom: 12, speed: 1.5 });
      }
    };
    const handleErr = (err: GeolocationPositionError) => {
      if (err.code === err.PERMISSION_DENIED) {
        setGeoStatus('denied');
        showDenied();
      } else {
        setGeoStatus('idle');
      }
    };
    const opts: PositionOptions = { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 };

    navigator.geolocation.getCurrentPosition(handlePos, handleErr, opts);
    if (geoWatchRef.current !== null) navigator.geolocation.clearWatch(geoWatchRef.current);
    geoWatchRef.current = navigator.geolocation.watchPosition(handlePos, handleErr, opts);
  }

  const GEO_STYLE: Record<typeof geoStatus, { bg: string; border: string; color: string; icon: string; title: string }> = {
    idle:    { bg: 'var(--cp-panel)',           border: 'var(--cp-border)',  color: 'var(--cp-muted)', icon: '◎', title: '現在地を取得' },
    loading: { bg: 'rgba(255,214,0,0.1)',        border: 'var(--cp-yellow)', color: 'var(--cp-yellow)', icon: '◌', title: '取得中...' },
    active:  { bg: 'rgba(0,229,255,0.18)',       border: 'var(--cp-cyan)',   color: 'var(--cp-cyan)',   icon: '◎', title: '現在地表示中' },
    denied:  { bg: 'rgba(255,23,68,0.1)',        border: 'var(--cp-red)',    color: 'var(--cp-red)',    icon: '✕', title: '位置情報がブロックされています。ブラウザ設定から許可してください' },
  };
  const gs = GEO_STYLE[geoStatus];

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={containerRef} className="w-full h-full" />

      {/* 現在地ボタン */}
      <button
        onClick={requestGeolocation}
        title={gs.title}
        style={{
          position: 'absolute',
          bottom: 48,
          right: 10,
          width: 36,
          height: 36,
          background: gs.bg,
          border: `1px solid ${gs.border}`,
          color: gs.color,
          fontSize: geoStatus === 'denied' ? 14 : 18,
          cursor: geoStatus === 'denied' ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
          borderRadius: 2,
          boxShadow: geoStatus === 'active' ? '0 0 8px rgba(0,229,255,0.3)' : geoStatus === 'denied' ? '0 0 8px rgba(255,23,68,0.2)' : 'none',
          animation: geoStatus === 'loading' ? 'cp-pulse 1s ease-in-out infinite' : 'none',
        }}
      >
        {gs.icon}
      </button>

      {/* 拒否された場合のツールチップ */}
      {geoStatus === 'denied' && showDeniedTooltip && (
        <div
          onClick={hideDenied}
          style={{
            position: 'absolute',
            bottom: 90,
            right: 10,
            background: 'rgba(6,8,18,0.95)',
            border: '1px solid var(--cp-red)',
            color: 'var(--cp-red)',
            fontSize: 9,
            letterSpacing: '0.08em',
            padding: '6px 8px',
            maxWidth: 160,
            lineHeight: 1.5,
            zIndex: 20,
            cursor: 'pointer',
            opacity: deniedFading ? 0 : 1,
            transition: 'opacity 0.6s ease',
          }}>
          ⚠ 位置情報がブロック中<br />
          <span style={{ color: 'var(--cp-muted)' }}>ブラウザ設定 → 位置情報を許可</span>
        </div>
      )}
    </div>
  );
}
