'use client';

import { useMemo, useState } from 'react';
import { useDisasterStore } from '@/store/useDisasterStore';
import type { DisasterEvent } from '@/lib/model';

// ────────────────────────────────────────────────
// ティッカーアイテム生成
// ────────────────────────────────────────────────
type TickerItem = { icon: string; text: string; level: 'info' | 'advisory' | 'warning' | 'emergency' };

const SEV_LEVEL = { emergency: 'emergency', warning: 'warning', advisory: 'advisory', info: 'info' } as const;

function eventsToItems(events: DisasterEvent[]): TickerItem[] {
  const items: TickerItem[] = [];

  // 地震
  const quakes = events.filter((e) => e.type === 'earthquake').slice(0, 3);
  if (quakes.length > 0) {
    const worst = quakes.reduce((a, b) =>
      ({ emergency: 4, warning: 3, advisory: 2, info: 1 }[a.severity] >= { emergency: 4, warning: 3, advisory: 2, info: 1 }[b.severity] ? a : b)
    );
    const mag = worst.title.match(/M[\d.]+/)?.[0] ?? '';
    const area = worst.area?.[0] ?? worst.title.slice(0, 10);
    items.push({ icon: '⚡', text: `地震: 直近${quakes.length}件 / ${area} ${mag}`.trim(), level: SEV_LEVEL[worst.severity] });
  }

  // 津波
  const tsunamis = events.filter((e) => e.type === 'tsunami');
  if (tsunamis.length > 0) {
    const worst = tsunamis.reduce((a, b) =>
      ({ emergency: 4, warning: 3, advisory: 2, info: 1 }[a.severity] >= { emergency: 4, warning: 3, advisory: 2, info: 1 }[b.severity] ? a : b)
    );
    items.push({ icon: '🌊', text: `津波: ${worst.title}`, level: SEV_LEVEL[worst.severity] });
  }

  // 線状降水帯
  const lp = events.filter((e) => e.type === 'linear_precip');
  if (lp.length > 0) {
    const area = [...new Set(lp.flatMap((e) => e.area ?? []))].slice(0, 2).join('・');
    items.push({ icon: '⛈', text: `線状降水帯: ${lp.length}件発生 / ${area || '確認中'}`, level: 'emergency' });
  }

  // 土砂
  const ls = events.filter((e) => e.type === 'landslide');
  if (ls.length > 0) {
    const area = [...new Set(ls.flatMap((e) => e.area ?? []))].slice(0, 2).join('・');
    items.push({ icon: '⛰', text: `土砂災害警戒: ${ls.length}件 / ${area || '確認中'}`, level: ls.some((e) => e.severity === 'emergency') ? 'emergency' : 'warning' });
  }

  // 洪水
  const floods = events.filter((e) => e.type === 'flood');
  if (floods.length > 0) {
    items.push({ icon: '💧', text: `洪水警報: ${floods.length}件`, level: 'warning' });
  }

  return items;
}

const LEVEL_COLOR = {
  emergency: '#ff1744',
  warning:   '#ff6d00',
  advisory:  '#ffd600',
  info:      '#00e5ff',
} as const;

// ────────────────────────────────────────────────
// メインコンポーネント
// ────────────────────────────────────────────────
export function NewsTicker({ onOpenModal }: { onOpenModal: () => void }) {
  const events         = useDisasterStore((s) => s.events);
  const typhoons       = useDisasterStore((s) => s.typhoons);
  const layers         = useDisasterStore((s) => s.layers);
  const linearPrecipBands = useDisasterStore((s) => s.linearPrecipBands);

  const items = useMemo<TickerItem[]>(() => {
    const base = eventsToItems(events);

    // 台風
    const active = typhoons.filter((t) => ['TY', 'STS', 'TS'].includes(t.category));
    if (active.length > 0) {
      const catLabel: Record<string, string> = { TY: '台風', STS: '強熱帯暴風', TS: '熱帯暴風', TD: '熱帯低気圧', ET: '温帯低気圧' };
      const t = active[0];
      const p = t.pressureHPa ? ` ${t.pressureHPa}hPa` : '';
      base.push({ icon: '🌀', text: `${catLabel[t.category] ?? '台風'} ${t.name}${p} 接近中`, level: t.pressureHPa && t.pressureHPa < 950 ? 'emergency' : 'warning' });
    }

    // 雨雲
    if (layers.rain) {
      base.push({ icon: '🌧', text: '雨雲レーダー: 降水ナウキャスト監視中', level: 'info' });
    }

    // 線状降水帯（バンドデータ優先）
    if (linearPrecipBands.length > 0 && !base.some((i) => i.icon === '⛈')) {
      const areas = linearPrecipBands.map((b) => b.area).slice(0, 2).join('・');
      base.push({ icon: '⛈', text: `線状降水帯: ${linearPrecipBands.length}件 / ${areas}`, level: 'emergency' });
    }

    if (base.length === 0) {
      base.push({ icon: '✅', text: '現在、重大な災害情報はありません', level: 'info' });
    }

    return base;
  }, [events, typhoons, layers.rain, linearPrecipBands]);

  // アイテムを区切り記号でつなぐ
  const tickerText = items.map((it) => `${it.icon} ${it.text}`).join('　　◆　　');
  const highestLevel = items.reduce<TickerItem['level']>((m, it) => {
    const rank = { emergency: 4, warning: 3, advisory: 2, info: 1 } as const;
    return rank[it.level] > rank[m] ? it.level : m;
  }, 'info');

  const accentColor = LEVEL_COLOR[highestLevel];

  return (
    <div
      style={{
        background: 'rgba(4,6,14,0.97)',
        borderTop: `1px solid ${accentColor}`,
        borderBottom: '1px solid var(--cp-border)',
        display: 'flex',
        alignItems: 'center',
        height: 28,
        overflow: 'hidden',
        flexShrink: 0,
        position: 'relative',
      }}
    >
      {/* ラベル */}
      <div
        style={{
          flexShrink: 0,
          background: accentColor,
          color: '#000',
          fontSize: 8,
          fontWeight: 700,
          letterSpacing: '0.12em',
          padding: '0 7px',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          fontFamily: 'var(--font-geist-mono, monospace)',
          whiteSpace: 'nowrap',
          zIndex: 2,
        }}
      >
        速報
      </div>

      {/* スクロールテキスト */}
      <div
        style={{
          flex: 1,
          overflow: 'hidden',
          position: 'relative',
          height: '100%',
          maskImage: 'linear-gradient(to right, transparent 0%, black 4%, black 96%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 4%, black 96%, transparent 100%)',
        }}
      >
        <div
          key={tickerText}
          style={{
            display: 'inline-block',
            whiteSpace: 'nowrap',
            color: 'var(--cp-text)',
            fontSize: 10,
            letterSpacing: '0.04em',
            lineHeight: '28px',
            animation: 'ticker-scroll 40s linear infinite',
            paddingLeft: '100%',
          }}
        >
          {tickerText}
          <span style={{ paddingLeft: '4em' }} />
          {tickerText}
        </div>
      </div>

      {/* ニュースボタン */}
      <button
        onClick={onOpenModal}
        style={{
          flexShrink: 0,
          background: 'rgba(0,229,255,0.1)',
          border: '1px solid var(--cp-cyan)',
          color: 'var(--cp-cyan)',
          fontSize: 8,
          letterSpacing: '0.12em',
          padding: '0 8px',
          height: '100%',
          cursor: 'pointer',
          fontFamily: 'var(--font-geist-mono, monospace)',
          whiteSpace: 'nowrap',
          zIndex: 2,
        }}
      >
        詳細 ›
      </button>

      <style>{`
        @keyframes ticker-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
