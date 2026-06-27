'use client';

import { useState, useEffect } from 'react';
import { useDisasterStore } from '@/store/useDisasterStore';
import type { LayerKey } from '@/store/useDisasterStore';
import type { DisasterEventType } from '@/lib/model';

const EVENT_TYPE_TO_LAYER_KEY: Partial<Record<DisasterEventType, LayerKey>> = {
  earthquake:    'earthquake',
  typhoon:       'typhoon',
  rain:          'rain',
  thunder:       'thunder',
  linear_precip: 'linearPrecip',
  landslide:     'landslide',
  flood:         'hazard',
  tsunami:       'tsunami',
};

// ────────────────────────────────────────────────
// 型定義
// ────────────────────────────────────────────────
type LegendItem = {
  color: string;
  label: string;
  sub?: string;
  shape?: 'square' | 'circle' | 'line' | 'dashed';
};

type LayerLegend = {
  layerKey: LayerKey;
  title: string;
  accentColor: string;
  unit?: string;
  items: LegendItem[];
};

// ────────────────────────────────────────────────
// 各レイヤーの凡例定義
// ────────────────────────────────────────────────
const LEGENDS: LayerLegend[] = [
  {
    layerKey: 'earthquake',
    title: '地震マーカー',
    accentColor: '#ff1744',
    unit: '最大震度',
    items: [
      { color: '#44445a', label: '震度1以下',  sub: 'INFO',       shape: 'circle' },
      { color: '#ffd600', label: '震度2〜3',   sub: 'ADVISORY',   shape: 'circle' },
      { color: '#ff6d00', label: '震度4〜5',   sub: 'WARNING',    shape: 'circle' },
      { color: '#ff1744', label: '震度6以上',  sub: 'EMERGENCY',  shape: 'circle' },
    ],
  },
  {
    layerKey: 'tsunami',
    title: '津波マーカー',
    accentColor: '#00b0ff',
    unit: '津波警報・情報（気象庁）',
    items: [
      { color: '#44445a', label: '情報',   sub: 'INFO',      shape: 'circle' },
      { color: '#ffd600', label: '注意報', sub: 'ADVISORY',  shape: 'circle' },
      { color: '#ff6d00', label: '警報',   sub: 'WARNING',   shape: 'circle' },
      { color: '#ff1744', label: '大津波', sub: 'EMERGENCY', shape: 'circle' },
    ],
  },
  {
    layerKey: 'hazard',
    title: 'ハザードマップ',
    accentColor: '#ff6d00',
    unit: '洪水浸水想定区域（浸水深・想定最大規模）',
    items: [
      { color: '#f5f0a0', label: '0.5m 未満' },
      { color: '#f5d26e', label: '0.5〜1m' },
      { color: '#f5a83a', label: '1〜2m' },
      { color: '#e86820', label: '2〜3m' },
      { color: '#c83228', label: '3〜5m' },
      { color: '#8b1a2e', label: '5〜10m' },
      { color: '#5a0a3c', label: '10m 以上' },
    ],
  },
  {
    layerKey: 'rain',
    title: '雨雲レーダー',
    accentColor: '#00e5ff',
    unit: '降水強度（mm/h）',
    items: [
      { color: '#a0d8ef', label: '1 未満',   sub: '霧雨程度' },
      { color: '#0064d4', label: '1〜5',     sub: '小雨' },
      { color: '#00b200', label: '5〜10',    sub: '普通の雨' },
      { color: '#f0f000', label: '10〜20',   sub: 'やや強い雨' },
      { color: '#ff8000', label: '20〜30',   sub: '強い雨' },
      { color: '#e00000', label: '30〜50',   sub: '激しい雨' },
      { color: '#c000c0', label: '50〜80',   sub: '非常に激しい雨' },
      { color: '#400040', label: '80 以上',  sub: '猛烈な雨' },
    ],
  },
  {
    layerKey: 'thunder',
    title: '雷レーダー',
    accentColor: '#ffd600',
    unit: '雷活動度（気象庁ナウキャスト）',
    items: [
      { color: '#fffe00', label: 'レベル1', sub: '雷あり' },
      { color: '#ffb300', label: 'レベル2', sub: '活発' },
      { color: '#ff6200', label: 'レベル3', sub: '非常に活発' },
      { color: '#ff0000', label: 'レベル4', sub: '激しい雷' },
    ],
  },
  {
    layerKey: 'linearPrecip',
    title: '線状降水帯',
    accentColor: '#0076ff',
    items: [
      { color: '#0076ff', label: '発生中・発達中', sub: '線状降水帯', shape: 'square' },
    ],
  },
  {
    layerKey: 'typhoon',
    title: '台風トラック',
    accentColor: '#e040fb',
    unit: '台風カテゴリ（RSMC分類）',
    items: [
      { color: '#ff1744', label: 'TY',  sub: '台風',        shape: 'circle' },
      { color: '#ff6d00', label: 'STS', sub: '強熱帯暴風',  shape: 'circle' },
      { color: '#e040fb', label: 'TS',  sub: '熱帯暴風',    shape: 'circle' },
      { color: '#78909c', label: 'TD',  sub: '熱帯低気圧',  shape: 'circle' },
      { color: '#546e7a', label: 'ET',  sub: '温帯低気圧',  shape: 'circle' },
      { color: '#e040fb', label: '──',  sub: '予報トラック', shape: 'dashed' },
      { color: '#78909c', label: '──',  sub: '過去トラック', shape: 'line' },
    ],
  },
  {
    layerKey: 'landslide',
    title: '土砂危険箇所',
    accentColor: '#a1887f',
    unit: '急傾斜地崩壊危険箇所',
    items: [
      { color: '#ff2020', label: '特別警戒区域', sub: 'レッドゾーン' },
      { color: '#ffd600', label: '警戒区域',     sub: 'イエローゾーン' },
    ],
  },
];

// ────────────────────────────────────────────────
// 凡例アイテム描画
// ────────────────────────────────────────────────
function ItemSwatch({ item }: { item: LegendItem }) {
  const shape = item.shape ?? 'square';

  if (shape === 'circle') {
    return (
      <span
        style={{
          background: item.color,
          width: 10,
          height: 10,
          borderRadius: '50%',
          flexShrink: 0,
          border: '1px solid rgba(255,255,255,0.2)',
        }}
      />
    );
  }
  if (shape === 'line') {
    return (
      <span style={{ width: 16, height: 2, background: item.color, flexShrink: 0, borderRadius: 1 }} />
    );
  }
  if (shape === 'dashed') {
    return (
      <span
        style={{
          width: 16,
          height: 2,
          flexShrink: 0,
          backgroundImage: `repeating-linear-gradient(90deg, ${item.color} 0, ${item.color} 4px, transparent 4px, transparent 7px)`,
        }}
      />
    );
  }
  return (
    <span
      style={{
        background: item.color,
        width: 11,
        height: 11,
        flexShrink: 0,
        border: '1px solid rgba(255,255,255,0.15)',
      }}
    />
  );
}

function Section({ legend, highlighted = false }: { legend: LayerLegend; highlighted?: boolean }) {
  return (
    <div style={{
      marginBottom: 10,
      ...(highlighted ? {
        background: 'rgba(0,229,255,0.06)',
        border: '1px solid rgba(0,229,255,0.3)',
        padding: '4px 4px 0',
        margin: '0 -4px 10px',
      } : {}),
    }}>
      {/* セクションヘッダー */}
      <div className="flex items-center gap-1.5 mb-1">
        <span style={{ background: legend.accentColor, width: 3, height: 12, flexShrink: 0 }} />
        <span style={{ color: legend.accentColor, fontSize: 8, letterSpacing: '0.14em' }} className="uppercase">
          {legend.title}
        </span>
      </div>
      {legend.unit && (
        <div style={{ color: 'var(--cp-muted)', fontSize: 7, letterSpacing: '0.06em', marginBottom: 4, paddingLeft: 7 }}>
          {legend.unit}
        </div>
      )}
      <div className="flex flex-col gap-0.5" style={{ paddingLeft: 7 }}>
        {legend.items.map((item, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <ItemSwatch item={item} />
            <span style={{ color: 'var(--cp-text)', fontSize: 9, lineHeight: 1.4 }}>
              {item.label}
              {item.sub && (
                <span style={{ color: 'var(--cp-muted)', fontSize: 7, marginLeft: 4 }}>
                  {item.sub}
                </span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────
// メインコンポーネント
// ────────────────────────────────────────────────
export function MapLegend({ isMobile = false }: { isMobile?: boolean }) {
  const [open, setOpen] = useState(() =>
    typeof window === 'undefined' ? true : !window.matchMedia('(max-width: 1023px)').matches
  );
  const layers        = useDisasterStore((s) => s.layers);
  const selectedEvent = useDisasterStore((s) => s.selectedEvent);

  const highlightedLayerKey = selectedEvent
    ? (EVENT_TYPE_TO_LAYER_KEY[selectedEvent.type] ?? null)
    : null;

  // イベント選択時に凡例を自動展開
  useEffect(() => {
    if (highlightedLayerKey) setOpen(true);
  }, [highlightedLayerKey]);

  const activeLegends = LEGENDS.filter((l) => layers[l.layerKey]);

  if (activeLegends.length === 0) return null;

  return (
    <div
      style={{
        flexShrink: 0,
        pointerEvents: 'auto',
      }}
    >
      {/* トグルヘッダー */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          width: '100%',
          background: 'rgba(6,8,18,0.92)',
          border: '1px solid var(--cp-cyan)',
          color: 'var(--cp-cyan)',
          fontSize: 8,
          letterSpacing: '0.2em',
          padding: '4px 8px',
          cursor: 'pointer',
          fontFamily: 'var(--font-geist-mono, monospace)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <span style={{ fontSize: 7, opacity: 0.6 }}>◈</span>
        <span>MAP LEGEND</span>
        <span
          style={{
            marginLeft: 'auto',
            background: 'rgba(0,229,255,0.15)',
            color: 'var(--cp-cyan)',
            fontSize: 7,
            padding: '1px 4px',
            letterSpacing: '0.1em',
          }}
        >
          {activeLegends.length} ACTIVE
        </span>
        <span style={{ fontSize: 7, opacity: 0.6 }}>{open ? '▲' : '▼'}</span>
      </button>

      {/* 凡例本体 */}
      {open && (
        <div
          style={{
            background: 'rgba(6,8,18,0.92)',
            border: '1px solid var(--cp-border)',
            borderTop: 'none',
            backdropFilter: 'blur(8px)',
            maxHeight: 260,
            overflowY: 'auto',
            position: 'relative',
          }}
        >
          {/* スキャンライン装飾 */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage:
                'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,255,255,0.012) 3px, rgba(0,255,255,0.012) 4px)',
              pointerEvents: 'none',
              zIndex: 0,
            }}
          />

          <div style={{ padding: '10px 10px 6px', position: 'relative', zIndex: 1 }}>
            {activeLegends.map((legend, i) => (
              <div key={legend.layerKey}>
                <Section legend={legend} highlighted={legend.layerKey === highlightedLayerKey} />
                {i < activeLegends.length - 1 && (
                  <div style={{ borderTop: '1px solid var(--cp-border)', marginBottom: 10 }} />
                )}
              </div>
            ))}

            <div
              style={{
                paddingTop: 5,
                borderTop: '1px solid var(--cp-border)',
                color: 'var(--cp-muted)',
                fontSize: 7,
                letterSpacing: '0.05em',
              }}
            >
              出典: 国土地理院 / 気象庁 / P2P地震情報
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
