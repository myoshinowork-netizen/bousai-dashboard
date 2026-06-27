'use client';

import { useEffect } from 'react';
import { useDisasterStore } from '@/store/useDisasterStore';
import type { ForecastDay } from '@/lib/model';

// ────────────────────────────────────────────────
// 47都道府県 → JMA エリアコード + 中心座標
// ────────────────────────────────────────────────
export const PREF_LIST: { code: string; label: string; lat: number; lng: number }[] = [
  { code: '016000', label: '北海道(札幌)', lat: 43.06, lng: 141.35 },
  { code: '011000', label: '北海道(宗谷)', lat: 45.40, lng: 141.67 },
  { code: '012000', label: '北海道(上川)', lat: 43.77, lng: 142.36 },
  { code: '013000', label: '北海道(網走)', lat: 43.91, lng: 144.27 },
  { code: '014030', label: '北海道(十勝)', lat: 42.92, lng: 143.20 },
  { code: '014100', label: '北海道(釧路)', lat: 43.00, lng: 144.38 },
  { code: '015000', label: '北海道(胆振)', lat: 42.61, lng: 141.60 },
  { code: '017000', label: '北海道(渡島)', lat: 41.77, lng: 140.73 },
  { code: '020000', label: '青森', lat: 40.82, lng: 140.74 },
  { code: '030000', label: '岩手', lat: 39.70, lng: 141.15 },
  { code: '040000', label: '宮城', lat: 38.27, lng: 140.87 },
  { code: '050000', label: '秋田', lat: 39.72, lng: 140.10 },
  { code: '060000', label: '山形', lat: 38.24, lng: 140.36 },
  { code: '070000', label: '福島', lat: 37.75, lng: 140.47 },
  { code: '080000', label: '茨城', lat: 36.34, lng: 140.45 },
  { code: '090000', label: '栃木', lat: 36.57, lng: 139.88 },
  { code: '100000', label: '群馬', lat: 36.39, lng: 139.06 },
  { code: '110000', label: '埼玉', lat: 35.86, lng: 139.65 },
  { code: '120000', label: '千葉', lat: 35.60, lng: 140.12 },
  { code: '130000', label: '東京', lat: 35.69, lng: 139.69 },
  { code: '140000', label: '神奈川', lat: 35.45, lng: 139.64 },
  { code: '150000', label: '新潟', lat: 37.90, lng: 139.02 },
  { code: '160000', label: '富山', lat: 36.70, lng: 137.21 },
  { code: '170000', label: '石川', lat: 36.59, lng: 136.63 },
  { code: '180000', label: '福井', lat: 36.07, lng: 136.22 },
  { code: '190000', label: '山梨', lat: 35.66, lng: 138.57 },
  { code: '200000', label: '長野', lat: 36.65, lng: 138.18 },
  { code: '210000', label: '岐阜', lat: 35.39, lng: 136.72 },
  { code: '220000', label: '静岡', lat: 34.98, lng: 138.38 },
  { code: '230000', label: '愛知', lat: 35.18, lng: 136.91 },
  { code: '240000', label: '三重', lat: 34.73, lng: 136.51 },
  { code: '250000', label: '滋賀', lat: 35.00, lng: 135.87 },
  { code: '260000', label: '京都', lat: 35.02, lng: 135.76 },
  { code: '270000', label: '大阪', lat: 34.69, lng: 135.50 },
  { code: '280000', label: '兵庫', lat: 34.69, lng: 135.18 },
  { code: '290000', label: '奈良', lat: 34.68, lng: 135.83 },
  { code: '300000', label: '和歌山', lat: 34.23, lng: 135.17 },
  { code: '310000', label: '鳥取', lat: 35.50, lng: 134.24 },
  { code: '320000', label: '島根', lat: 35.47, lng: 133.05 },
  { code: '330000', label: '岡山', lat: 34.66, lng: 133.93 },
  { code: '340000', label: '広島', lat: 34.40, lng: 132.46 },
  { code: '350000', label: '山口', lat: 34.19, lng: 131.47 },
  { code: '360000', label: '徳島', lat: 34.07, lng: 134.56 },
  { code: '370000', label: '香川', lat: 34.34, lng: 134.04 },
  { code: '380000', label: '愛媛', lat: 33.84, lng: 132.77 },
  { code: '390000', label: '高知', lat: 33.56, lng: 133.53 },
  { code: '400000', label: '福岡', lat: 33.61, lng: 130.42 },
  { code: '410000', label: '佐賀', lat: 33.25, lng: 130.30 },
  { code: '420000', label: '長崎', lat: 32.74, lng: 129.87 },
  { code: '430000', label: '熊本', lat: 32.79, lng: 130.74 },
  { code: '440000', label: '大分', lat: 33.24, lng: 131.61 },
  { code: '450000', label: '宮崎', lat: 31.91, lng: 131.42 },
  { code: '460040', label: '鹿児島', lat: 31.56, lng: 130.56 },
  { code: '471000', label: '沖縄本島', lat: 26.21, lng: 127.68 },
  { code: '472000', label: '沖縄(大東)', lat: 25.83, lng: 131.23 },
  { code: '473000', label: '沖縄(宮古)', lat: 24.80, lng: 125.28 },
  { code: '474000', label: '沖縄(八重山)', lat: 24.34, lng: 124.16 },
];

export function nearestPref(lat: number, lng: number): string {
  let best = PREF_LIST[0];
  let bestDist = Infinity;
  for (const p of PREF_LIST) {
    const d = Math.hypot(p.lat - lat, p.lng - lng);
    if (d < bestDist) { bestDist = d; best = p; }
  }
  return best.code;
}

// ────────────────────────────────────────────────
// 天気コード → アイコン / ラベル / 背景色
// ────────────────────────────────────────────────
const WEATHER_META: Record<string, { icon: string; color: string }> = {
  '1':  { icon: '☀',  color: '#ffd600' },
  '10': { icon: '☀',  color: '#ffd600' },
  '11': { icon: '🌤', color: '#ffd600' },
  '12': { icon: '🌦', color: '#64b5f6' },
  '13': { icon: '🌦', color: '#64b5f6' },
  '2':  { icon: '☁',  color: '#90a4ae' },
  '20': { icon: '☁',  color: '#90a4ae' },
  '21': { icon: '⛅', color: '#b0bec5' },
  '22': { icon: '🌧', color: '#42a5f5' },
  '23': { icon: '🌧', color: '#42a5f5' },
  '3':  { icon: '🌧', color: '#1e88e5' },
  '30': { icon: '🌧', color: '#1e88e5' },
  '31': { icon: '🌤', color: '#ffd600' },
  '4':  { icon: '❄',  color: '#b3e5fc' },
  '40': { icon: '❄',  color: '#b3e5fc' },
  '5':  { icon: '⛈', color: '#e040fb' },
};

function getMeta(code: string): { icon: string; color: string } {
  return (
    WEATHER_META[code.slice(0, 2)] ??
    WEATHER_META[code.slice(0, 1)] ??
    { icon: '🌡', color: '#78909c' }
  );
}

// ────────────────────────────────────────────────
// 日付フォーマット
// ────────────────────────────────────────────────
const DAY_JA = ['日', '月', '火', '水', '木', '金', '土'];

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const dow = d.getDay();
  const color = dow === 0 ? '#ff5252' : dow === 6 ? '#42a5f5' : 'var(--cp-muted)';
  return { label: `${d.getMonth() + 1}/${d.getDate()}`, day: DAY_JA[dow], color };
}

// ────────────────────────────────────────────────
// 降水確率バー
// ────────────────────────────────────────────────
function PopBar({ pop }: { pop: number }) {
  const color =
    pop >= 70 ? '#1e88e5'
    : pop >= 40 ? '#42a5f5'
    : pop >= 20 ? '#90caf9'
    : '#37474f';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
      <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${pop}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.4s' }} />
      </div>
      <span style={{ color, fontSize: 9, fontWeight: 700, minWidth: 22, textAlign: 'right', letterSpacing: 0 }}>
        {pop}%
      </span>
    </div>
  );
}

// ────────────────────────────────────────────────
// 1日分の行
// ────────────────────────────────────────────────
function DayRow({ day, isToday }: { day: ForecastDay; isToday: boolean }) {
  const { label, day: dow, color: dowColor } = formatDate(day.date);
  const meta = getMeta(day.weatherCode);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '40px 22px 1fr 52px',
        alignItems: 'center',
        gap: 6,
        padding: '5px 10px',
        background: isToday ? 'rgba(0,229,255,0.06)' : 'transparent',
        borderLeft: isToday ? '2px solid var(--cp-cyan)' : '2px solid transparent',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
      }}
    >
      {/* 日付 */}
      <div style={{ lineHeight: 1.2 }}>
        <div style={{ color: 'var(--cp-text)', fontSize: 10, letterSpacing: '0.04em' }}>{label}</div>
        <div style={{ color: dowColor, fontSize: 9, letterSpacing: '0.1em', fontWeight: 700 }}>{dow}</div>
      </div>

      {/* アイコン */}
      <span style={{ fontSize: 16, textAlign: 'center' }}>{meta.icon}</span>

      {/* 天気テキスト + 降水確率バー */}
      <div style={{ minWidth: 0 }}>
        <div style={{
          color: meta.color,
          fontSize: 9,
          letterSpacing: '0.03em',
          marginBottom: 3,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {day.weather}
        </div>
        <PopBar pop={day.popMax} />
      </div>

      {/* 気温 高/低 */}
      <div style={{ textAlign: 'right', lineHeight: 1.3 }}>
        {day.tempMax !== undefined ? (
          <div style={{ color: '#ff7043', fontSize: 11, fontWeight: 700, letterSpacing: 0 }}>
            {day.tempMax}°
          </div>
        ) : (
          <div style={{ color: 'var(--cp-muted)', fontSize: 11 }}>－</div>
        )}
        {day.tempMin !== undefined ? (
          <div style={{ color: '#42a5f5', fontSize: 10, letterSpacing: 0 }}>
            {day.tempMin}°
          </div>
        ) : (
          <div style={{ color: 'var(--cp-muted)', fontSize: 10 }}>－</div>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────
// メインコンポーネント
// ────────────────────────────────────────────────
export function WeeklyForecast() {
  const forecastDays    = useDisasterStore((s) => s.forecastDays);
  const forecastArea    = useDisasterStore((s) => s.forecastArea);
  const userLocation    = useDisasterStore((s) => s.userLocation);
  const setForecastDays = useDisasterStore((s) => s.setForecastDays);
  const setForecastArea = useDisasterStore((s) => s.setForecastArea);

  useEffect(() => {
    async function fetchForecast() {
      try {
        const res = await fetch(`/api/weather-forecast?area=${forecastArea}`);
        if (!res.ok) return;
        const { days } = await res.json();
        setForecastDays(days ?? []);
      } catch { /* ignore */ }
    }
    fetchForecast();
    const id = setInterval(fetchForecast, 60 * 60 * 1000);
    return () => clearInterval(id);
  }, [forecastArea, setForecastDays]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* ヘッダー */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 10px 5px',
          borderBottom: '1px solid var(--cp-border)',
          background: 'var(--cp-panel2)',
          flexShrink: 0,
        }}
      >
        <span style={{ color: 'var(--cp-cyan)', fontSize: 9, letterSpacing: '0.18em' }}>WEATHER FCST</span>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
          {/* 現在地から最寄りエリアを自動選択 */}
          {userLocation && (
            <button
              onClick={() => setForecastArea(nearestPref(userLocation.lat, userLocation.lng))}
              title="現在地のエリアに切り替え"
              style={{
                background: 'rgba(0,229,255,0.12)',
                border: '1px solid var(--cp-border2)',
                color: 'var(--cp-cyan)',
                fontSize: 11,
                padding: '2px 6px',
                cursor: 'pointer',
                letterSpacing: '0.05em',
              }}
            >
              ◎ 現在地
            </button>
          )}
          <select
            value={forecastArea}
            onChange={(e) => setForecastArea(e.target.value)}
            style={{
              background: 'var(--cp-bg)',
              color: 'var(--cp-cyan)',
              border: '1px solid var(--cp-border2)',
              fontSize: 10,
              padding: '2px 6px',
              letterSpacing: '0.08em',
              cursor: 'pointer',
              maxWidth: 100,
            }}
          >
            {PREF_LIST.map((a) => (
              <option key={a.code} value={a.code}>{a.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 列ヘッダー */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '40px 22px 1fr 52px',
        gap: 6,
        padding: '3px 10px',
        background: 'rgba(0,0,0,0.2)',
        borderBottom: '1px solid var(--cp-border)',
      }}>
        <span style={{ color: 'var(--cp-muted)', fontSize: 8, letterSpacing: '0.1em' }}>日付</span>
        <span style={{ color: 'var(--cp-muted)', fontSize: 8 }} />
        <span style={{ color: 'var(--cp-muted)', fontSize: 8, letterSpacing: '0.05em' }}>天気　　　　降水確率</span>
        <span style={{ color: 'var(--cp-muted)', fontSize: 8, textAlign: 'right', letterSpacing: '0.05em' }}>高/低°C</span>
      </div>

      {/* 予報リスト */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {forecastDays.length === 0 ? (
          <div style={{ color: 'var(--cp-muted)', fontSize: 10, textAlign: 'center', padding: '20px 0', letterSpacing: '0.1em' }}>
            LOADING...
          </div>
        ) : (
          forecastDays.slice(0, 7).map((day) => (
            <DayRow key={day.date} day={day} isToday={day.date === today} />
          ))
        )}
      </div>
    </div>
  );
}
