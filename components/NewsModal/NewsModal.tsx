'use client';

import { useMemo } from 'react';
import { useDisasterStore } from '@/store/useDisasterStore';
import type { DisasterEvent } from '@/lib/model';

// ────────────────────────────────────────────────
// 型・定数
// ────────────────────────────────────────────────
type NewsCard = {
  id: string;
  icon: string;
  title: string;
  status: string;
  body: string;
  level: 'info' | 'advisory' | 'warning' | 'emergency';
  links: { label: string; url: string }[];
};

const LEVEL_COLOR = {
  emergency: '#ff1744',
  warning:   '#ff6d00',
  advisory:  '#ffd600',
  info:      '#546e7a',
} as const;

const LEVEL_LABEL = {
  emergency: '緊急',
  warning:   '警報',
  advisory:  '注意報',
  info:      '情報',
} as const;

function severityToLevel(sev: DisasterEvent['severity']): NewsCard['level'] {
  return sev === 'emergency' ? 'emergency' : sev === 'warning' ? 'warning' : sev === 'advisory' ? 'advisory' : 'info';
}

// ────────────────────────────────────────────────
// カード生成
// ────────────────────────────────────────────────
function buildCards(
  events: ReturnType<typeof useDisasterStore.getState>['events'],
  typhoons: ReturnType<typeof useDisasterStore.getState>['typhoons'],
  linearPrecipBands: ReturnType<typeof useDisasterStore.getState>['linearPrecipBands'],
  landslideWarnings: ReturnType<typeof useDisasterStore.getState>['landslideWarnings'],
  layers: ReturnType<typeof useDisasterStore.getState>['layers'],
): NewsCard[] {
  const cards: NewsCard[] = [];

  // 地震
  const quakes = events.filter((e) => e.type === 'earthquake');
  if (quakes.length > 0) {
    const worst = quakes.reduce((a, b) =>
      ({ emergency: 4, warning: 3, advisory: 2, info: 1 }[a.severity] >= { emergency: 4, warning: 3, advisory: 2, info: 1 }[b.severity] ? a : b)
    );
    const recent = quakes.filter((e) => Date.now() - new Date(e.occurredAt).getTime() < 3600_000);
    const areas = [...new Set(quakes.flatMap((e) => e.area ?? []))].slice(0, 4).join('・');
    cards.push({
      id: 'earthquake',
      icon: '⚡',
      title: '地震情報',
      status: `直近1h ${recent.length}件 / ${worst.title.match(/M[\d.]+/)?.[0] ?? ''} ${worst.area?.[0] ?? ''}`,
      body: `最大 ${worst.title}。主な震源地域: ${areas || '確認中'}。気象庁の最新情報を確認してください。`,
      level: severityToLevel(worst.severity),
      links: [
        { label: '気象庁 地震情報', url: 'https://www.jma.go.jp/bosai/quake/' },
        { label: 'P2P地震情報', url: 'https://www.p2pquake.net/' },
        { label: '防災科研 F-net', url: 'https://www.fnet.bosai.go.jp/' },
      ],
    });
  }

  // 津波
  const tsunamis = events.filter((e) => e.type === 'tsunami');
  if (tsunamis.length > 0) {
    const worst = tsunamis.reduce((a, b) =>
      ({ emergency: 4, warning: 3, advisory: 2, info: 1 }[a.severity] >= { emergency: 4, warning: 3, advisory: 2, info: 1 }[b.severity] ? a : b)
    );
    cards.push({
      id: 'tsunami',
      icon: '🌊',
      title: '津波情報',
      status: worst.title,
      body: `${tsunamis.length}件の津波情報が発令中。${worst.area?.join('・') ?? ''}の沿岸・河口付近に注意。気象庁の最新情報に従い行動してください。`,
      level: severityToLevel(worst.severity),
      links: [
        { label: '気象庁 津波情報', url: 'https://www.jma.go.jp/bosai/tsunami/' },
        { label: '国土地理院 浸水推定', url: 'https://disaportal.gsi.go.jp/' },
      ],
    });
  }

  // 台風
  const activeTyphoons = typhoons.filter((t) => ['TY', 'STS', 'TS'].includes(t.category));
  if (activeTyphoons.length > 0) {
    const catLabel: Record<string, string> = { TY: '台風', STS: '強熱帯暴風', TS: '熱帯暴風', TD: '熱帯低気圧', ET: '温帯低気圧' };
    const t = activeTyphoons[0];
    const p = t.pressureHPa;
    const level: NewsCard['level'] = p && p < 920 ? 'emergency' : p && p < 950 ? 'emergency' : p && p < 970 ? 'warning' : 'advisory';
    cards.push({
      id: 'typhoon',
      icon: '🌀',
      title: '台風・熱帯低気圧',
      status: activeTyphoons.map((ty) => `${catLabel[ty.category] ?? '台風'} ${ty.name}${ty.pressureHPa ? ` (${ty.pressureHPa}hPa)` : ''}`).join(' / '),
      body: `${activeTyphoons.length}個の${catLabel[t.category] ?? '台風'}が活動中。最新の進路予報を確認し、暴風・高波・大雨に警戒してください。`,
      level,
      links: [
        { label: '気象庁 台風情報', url: 'https://www.jma.go.jp/bosai/map.html#13/typhoon' },
        { label: '気象庁 天気図', url: 'https://www.jma.go.jp/bosai/weather_map/' },
        { label: 'デジタル台風', url: 'https://agora.ex.nii.ac.jp/digital-typhoon/' },
      ],
    });
  }

  // 線状降水帯
  const lpEvents = events.filter((e) => e.type === 'linear_precip');
  if (linearPrecipBands.length > 0 || lpEvents.length > 0) {
    const count = linearPrecipBands.length > 0 ? linearPrecipBands.length : lpEvents.length;
    const areas = linearPrecipBands.length > 0
      ? linearPrecipBands.map((b) => b.area).join('・')
      : [...new Set(lpEvents.flatMap((e) => e.area ?? []))].join('・') || '確認中';
    cards.push({
      id: 'linearPrecip',
      icon: '⛈',
      title: '線状降水帯',
      status: `${count}件発生 / ${areas}`,
      body: '線状降水帯が確認されています。同一地域に極めて激しい雨が継続し、甚大な浸水・土砂災害の危険が差し迫っています。直ちに安全な場所へ避難してください。',
      level: 'emergency',
      links: [
        { label: '気象庁 大雨・洪水警報', url: 'https://www.jma.go.jp/bosai/warning/' },
        { label: '気象庁 雨雲ナウキャスト', url: 'https://www.jma.go.jp/bosai/nowc/' },
      ],
    });
  }

  // 土砂災害
  const lsEvents = events.filter((e) => e.type === 'landslide');
  if (landslideWarnings.length > 0 || lsEvents.length > 0) {
    const count = landslideWarnings.length > 0 ? landslideWarnings.length : lsEvents.length;
    const areas = landslideWarnings.length > 0
      ? [...new Set(landslideWarnings.map((w) => w.prefecture))].join('・')
      : [...new Set(lsEvents.flatMap((e) => e.area ?? []))].join('・') || '確認中';
    const isEmergency = landslideWarnings.some((w) => w.level === 'emergency') || lsEvents.some((e) => e.severity === 'emergency');
    cards.push({
      id: 'landslide',
      icon: '⛰',
      title: '土砂災害警戒情報',
      status: `${count}件発令 / ${areas}`,
      body: isEmergency
        ? '土砂災害緊急警戒情報が発令されています。崖崩れ・土石流の危険が切迫しています。今すぐ安全な場所へ避難してください。'
        : '土砂災害警戒情報が発令されています。崖・沢・渓流沿いから離れ、避難準備を開始してください。',
      level: isEmergency ? 'emergency' : 'warning',
      links: [
        { label: '気象庁 土砂災害警戒情報', url: 'https://www.jma.go.jp/bosai/mesh_warning/' },
        { label: '国土地理院 土砂崩れ危険箇所', url: 'https://disaportal.gsi.go.jp/' },
      ],
    });
  }

  // 雨雲（レイヤーON時）
  if (layers.rain) {
    cards.push({
      id: 'rain',
      icon: '🌧',
      title: '雨雲レーダー（監視中）',
      status: '降水ナウキャスト: 5分更新',
      body: '気象庁ナウキャストデータを表示中。赤・紫の強雨エリア（30mm/h以上）では急激な浸水・河川氾濫の可能性があります。',
      level: 'info',
      links: [
        { label: '気象庁 雨雲ナウキャスト', url: 'https://www.jma.go.jp/bosai/nowc/' },
        { label: '気象庁 大雨警報', url: 'https://www.jma.go.jp/bosai/warning/' },
      ],
    });
  }

  // 情報なし
  if (cards.length === 0) {
    cards.push({
      id: 'none',
      icon: '✅',
      title: '重大な災害情報なし',
      status: '現在、重大な気象・地震情報はありません',
      body: '引き続き最新の気象情報・地震情報をご確認ください。非常持ち出し品や避難場所の事前確認をお勧めします。',
      level: 'info',
      links: [
        { label: '気象庁 防災情報', url: 'https://www.jma.go.jp/bosai/' },
        { label: '内閣府 防災', url: 'https://www.bousai.go.jp/' },
        { label: 'NHK 防災・気象', url: 'https://www3.nhk.or.jp/sokuho/' },
      ],
    });
  }

  return cards;
}

// ────────────────────────────────────────────────
// UI コンポーネント
// ────────────────────────────────────────────────
function CardItem({ card }: { card: NewsCard }) {
  const color = LEVEL_COLOR[card.level];
  const label = LEVEL_LABEL[card.level];

  return (
    <div
      style={{
        background: 'rgba(6,8,18,0.95)',
        border: `1px solid ${color}`,
        borderLeft: `3px solid ${color}`,
        padding: '10px 12px',
        marginBottom: 8,
      }}
    >
      {/* ヘッダー */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 16 }}>{card.icon}</span>
        <span style={{ color, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', flex: 1 }}>{card.title}</span>
        <span
          style={{
            background: `${color}22`,
            border: `1px solid ${color}`,
            color,
            fontSize: 8,
            padding: '1px 6px',
            letterSpacing: '0.12em',
            flexShrink: 0,
          }}
        >
          {label}
        </span>
      </div>

      {/* ステータス */}
      <div
        style={{
          color: 'var(--cp-text)',
          fontSize: 10,
          letterSpacing: '0.04em',
          marginBottom: 6,
          paddingBottom: 6,
          borderBottom: '1px solid var(--cp-border)',
        }}
      >
        {card.status}
      </div>

      {/* 本文 */}
      <p style={{ color: 'var(--cp-muted)', fontSize: 10, lineHeight: 1.6, margin: '0 0 8px' }}>
        {card.body}
      </p>

      {/* リンク */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {card.links.map((link) => (
          <a
            key={link.url}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: 'var(--cp-cyan)',
              fontSize: 9,
              letterSpacing: '0.06em',
              padding: '2px 7px',
              border: '1px solid rgba(0,229,255,0.3)',
              background: 'rgba(0,229,255,0.06)',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            {link.label} ↗
          </a>
        ))}
      </div>
    </div>
  );
}

export function NewsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const events            = useDisasterStore((s) => s.events);
  const typhoons          = useDisasterStore((s) => s.typhoons);
  const linearPrecipBands = useDisasterStore((s) => s.linearPrecipBands);
  const landslideWarnings = useDisasterStore((s) => s.landslideWarnings);
  const layers            = useDisasterStore((s) => s.layers);

  const cards = useMemo(
    () => buildCards(events, typhoons, linearPrecipBands, landslideWarnings, layers),
    [events, typhoons, linearPrecipBands, landslideWarnings, layers]
  );

  if (!open) return null;

  return (
    <>
      {/* オーバーレイ */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          zIndex: 100,
          backdropFilter: 'blur(2px)',
        }}
      />

      {/* パネル */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 101,
          maxHeight: '80svh',
          display: 'flex',
          flexDirection: 'column',
          background: 'rgba(4,6,14,0.98)',
          border: '1px solid var(--cp-cyan)',
          borderBottom: 'none',
          fontFamily: 'var(--font-geist-mono, monospace)',
        }}
      >
        {/* モーダルヘッダー */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 14px',
            borderBottom: '1px solid var(--cp-border)',
            flexShrink: 0,
          }}
        >
          <span style={{ color: 'var(--cp-cyan)', fontSize: 8, letterSpacing: '0.2em' }}>◈ 統合ニュース</span>
          <span style={{ color: 'var(--cp-muted)', fontSize: 8, marginLeft: 4 }}>
            {cards.length} カテゴリ
          </span>
          <div style={{ flex: 1 }} />
          <span style={{ color: 'var(--cp-muted)', fontSize: 8, letterSpacing: '0.08em' }}>
            出典: 気象庁 / 国土地理院 / P2P地震情報
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: '1px solid var(--cp-border)',
              color: 'var(--cp-muted)',
              fontSize: 10,
              width: 24,
              height: 24,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>

        {/* カード一覧 */}
        <div style={{ overflowY: 'auto', padding: '10px 12px', flex: 1 }}>
          {cards.map((card) => (
            <CardItem key={card.id} card={card} />
          ))}
        </div>
      </div>
    </>
  );
}
