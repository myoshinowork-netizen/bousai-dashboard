'use client';

import { useState, useEffect, useRef } from 'react';
import { useDisasterStore } from '@/store/useDisasterStore';
import type { DisasterEvent, DisasterEventType, TyphoonInfo, LinearPrecipBand, LandslideWarning } from '@/lib/model';

const EVENT_TYPE_TO_REPORT_ID: Partial<Record<DisasterEventType, string>> = {
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
// 型
// ────────────────────────────────────────────────
type DangerLevel = 1 | 2 | 3 | 4 | 5;
type EvacLevel   = 1 | 2 | 3 | 4;

type SituationReport = {
  id: string;
  icon: string;
  title: string;
  level: DangerLevel;
  evacLevel: EvacLevel;
  status: string;
  detail: string;
  actions: string[];
};

// ────────────────────────────────────────────────
// 危険レベル定義
// ────────────────────────────────────────────────
const LEVEL_META: Record<DangerLevel, { label: string; color: string; bg: string }> = {
  1: { label: 'LEVEL 1', color: '#78909c', bg: 'rgba(120,144,156,0.15)' },
  2: { label: 'LEVEL 2', color: '#ffd600', bg: 'rgba(255,214,0,0.12)'   },
  3: { label: 'LEVEL 3', color: '#ff6d00', bg: 'rgba(255,109,0,0.12)'   },
  4: { label: 'LEVEL 4', color: '#ff1744', bg: 'rgba(255,23,68,0.12)'   },
  5: { label: 'LEVEL 5', color: '#ff1744', bg: 'rgba(255,23,68,0.2)'    },
};

// ────────────────────────────────────────────────
// 避難レベル定義（4段階）
// ────────────────────────────────────────────────
const EVAC_META: Record<EvacLevel, {
  label: string;
  sublabel: string;
  icon: string;
  color: string;
  bg: string;
  border: string;
}> = {
  1: {
    label: '避難レベル 1',
    sublabel: '様子見',
    icon: '●',
    color: '#78909c',
    bg: 'rgba(120,144,156,0.12)',
    border: 'rgba(120,144,156,0.4)',
  },
  2: {
    label: '避難レベル 2',
    sublabel: '避難準備',
    icon: '◆',
    color: '#ffd600',
    bg: 'rgba(255,214,0,0.1)',
    border: 'rgba(255,214,0,0.5)',
  },
  3: {
    label: '避難レベル 3',
    sublabel: '高齢者等避難',
    icon: '▲',
    color: '#ff6d00',
    bg: 'rgba(255,109,0,0.12)',
    border: 'rgba(255,109,0,0.6)',
  },
  4: {
    label: '避難レベル 4',
    sublabel: '避難勧告',
    icon: '!!',
    color: '#ff1744',
    bg: 'rgba(255,23,68,0.15)',
    border: 'rgba(255,23,68,0.7)',
  },
};

// ────────────────────────────────────────────────
// レポート生成ロジック
// ────────────────────────────────────────────────
function buildEarthquakeReport(events: DisasterEvent[]): SituationReport | null {
  const quakes = events.filter((e) => e.type === 'earthquake');
  if (quakes.length === 0) return null;

  const worst = quakes.reduce((a, b) => {
    const rank = { emergency: 4, warning: 3, advisory: 2, info: 1 } as const;
    return rank[a.severity] >= rank[b.severity] ? a : b;
  });

  const level: DangerLevel =
    worst.severity === 'emergency' ? 4
    : worst.severity === 'warning'   ? 3
    : worst.severity === 'advisory'  ? 2
    : 1;

  const recentCount = quakes.filter(
    (e) => Date.now() - new Date(e.occurredAt).getTime() < 60 * 60 * 1000,
  ).length;

  const evacLevel: EvacLevel =
    level >= 4 ? 4
    : level === 3 ? 3
    : level === 2 ? 2
    : 1;

  return {
    id: 'earthquake',
    icon: '⚡',
    title: '地震活動',
    level,
    evacLevel,
    status: `直近 ${recentCount} 件 ／ 最大 ${worst.title.match(/M[\d.]+/)?.[0] ?? '不明'}`,
    detail:
      level >= 4 ? '強い揺れが観測されています。津波の可能性を確認し、すべての方が速やかに安全な場所へ避難してください。'
      : level === 3 ? '有感地震が発生しています。高齢者・障害者など要配慮者は避難を開始してください。'
      : level === 2 ? '微小〜小規模の地震が継続しています。非常持ち出し品と避難経路を確認してください。'
      : '現在、地震活動は平常レベルです。引き続き情報を収集してください。',
    actions:
      level >= 4
        ? ['【全員避難】直ちに安全な場所へ', '津波警報・沿岸部は高台へ移動', '余震・火災に備え建物から離れる', '自治体の避難指示に従う']
        : level === 3
        ? ['【要配慮者避難開始】高齢者・障害者・乳幼児は先に避難', '避難場所・経路を家族で確認', '落下物・ガラスに注意し屋外へ']
        : level === 2
        ? ['【避難準備】非常袋・持ち出し品を玄関に用意', '避難場所・経路を事前に確認', '家具転倒防止の状況を確認']
        : ['【様子見】最新の地震情報を確認', '非常袋の中身を定期点検', '家族の連絡手段を確認しておく'],
  };
}

function buildTyphoonReport(typhoons: TyphoonInfo[]): SituationReport | null {
  if (typhoons.length === 0) return null;

  const active = typhoons.filter((t) =>
    ['TY', 'STS', 'TS'].includes(t.category),
  );

  const strongest = [...typhoons].sort((a, b) => (a.pressureHPa || 9999) - (b.pressureHPa || 9999))[0];
  const p = strongest.pressureHPa;

  const level: DangerLevel =
    p > 0 && p < 920 ? 5
    : p < 950         ? 4
    : p < 970         ? 3
    : active.length > 0 ? 2
    : 1;

  const catLabel: Record<string, string> = {
    TY: '台風', STS: '強熱帯暴風', TS: '熱帯暴風', TD: '熱帯低気圧', ET: '温帯低気圧', unknown: '熱帯じょう乱',
  };

  const evacLevel: EvacLevel =
    level >= 4 ? 4
    : level === 3 ? 3
    : level === 2 ? 2
    : 1;

  return {
    id: 'typhoon',
    icon: '🌀',
    title: '台風・熱帯低気圧',
    level,
    evacLevel,
    status: typhoons.map((t) => `${catLabel[t.category] ?? '台風'} ${t.name}${p ? ` ${p}hPa` : ''}`).join(' ／ '),
    detail:
      level >= 4 ? '非常に強い台風が接近中です。暴風・高波・大雨に厳重に警戒し、すべての方が早期避難を実施してください。'
      : level === 3 ? '強い台風が発生・接近しています。高齢者等要配慮者は今のうちに避難を開始してください。'
      : level === 2 ? '熱帯低気圧・台風が発生しています。避難場所・経路の事前確認を推奨します。'
      : '台風活動は比較的弱い状態です。進路・勢力の変化を継続的に確認してください。',
    actions:
      level >= 4
        ? ['【全員避難】暴風到達前に完了させる', '浸水・土砂危険区域から高台へ移動', '河川・海岸・山際には近づかない', '自治体の避難指示に従い行動']
        : level === 3
        ? ['【要配慮者避難開始】高齢者・障害者は先行避難', '風雨強まる前に避難場所を確認', '側溝・河川の増水に注意']
        : level === 2
        ? ['【避難準備】非常持ち出し品・食料を準備', '避難場所・避難経路を家族で確認', '暴風対策（窓の施錠・雨戸）を実施']
        : ['【様子見】台風の動向を継続監視', '非常袋・持ち出し品の点検', '進路予報を定期的に確認'],
  };
}

function buildRainReport(isActive: boolean): SituationReport | null {
  if (!isActive) return null;
  return {
    id: 'rain',
    icon: '🌧',
    title: '雨雲レーダー',
    level: 2,
    evacLevel: 2,
    status: '降水ナウキャスト監視中（5分更新）',
    detail: '気象庁ナウキャストデータをリアルタイムに表示しています。赤・紫の領域（30mm/h以上）では急激な浸水・河川氾濫が発生する恐れがあります。',
    actions: ['【避難準備】赤・紫エリア付近は移動を中止', '地下・半地下・低地からの退避を準備', '河川増水情報を継続確認', '非常持ち出し品を手の届く場所に'],
  };
}

function buildThunderReport(isActive: boolean): SituationReport | null {
  if (!isActive) return null;
  return {
    id: 'thunder',
    icon: '⚡',
    title: '雷レーダー',
    level: 2,
    evacLevel: 2,
    status: '雷ナウキャスト監視中（1時間予報）',
    detail: '雷活動度をレベル1〜4で表示。赤（レベル4）は激しい落雷が発生している領域です。屋外活動は即時中断してください。',
    actions: ['【避難準備】屋外作業・活動を直ちに中断', '丈夫な建物・車内に退避', '高い木・鉄塔・電柱に近づかない', '退避先で雷雲の通過を待つ'],
  };
}

function buildLinearPrecipReport(bands: LinearPrecipBand[], events: DisasterEvent[]): SituationReport | null {
  const evEvents = events.filter((e) => e.type === 'linear_precip');
  if (bands.length === 0 && evEvents.length === 0) return null;
  const areas = bands.length > 0
    ? bands.map((b) => b.area).join('・')
    : [...new Set(evEvents.flatMap((e) => e.area ?? []))].slice(0, 3).join('・') || '確認中';
  const count = bands.length > 0 ? bands.length : evEvents.length;
  return {
    id: 'linearPrecip',
    icon: '⛈',
    title: '線状降水帯',
    level: 4,
    evacLevel: 4,
    status: `${count} 件発生中 ／ ${areas}`,
    detail: '線状降水帯が確認されています。極めて激しい雨が同一地域に長時間継続し、甚大な浸水・土砂災害の危険が差し迫っています。',
    actions: ['【全員避難】直ちに安全な場所へ移動', '河川・山際・低地から離れ高台へ', '地下・半地下・車道の浸水路に入らない', '自治体の避難指示・警報に即座に従う'],
  };
}

function buildLandslideReport(warnings: LandslideWarning[], events: DisasterEvent[]): SituationReport | null {
  const evEvents = events.filter((e) => e.type === 'landslide');
  if (warnings.length === 0 && evEvents.length === 0) return null;
  const hasEmergency = warnings.some((w) => w.level === 'emergency')
    || evEvents.some((e) => e.severity === 'emergency');
  const areas = warnings.length > 0
    ? [...new Set(warnings.map((w) => w.prefecture))].join('・')
    : [...new Set(evEvents.flatMap((e) => e.area ?? []))].slice(0, 3).join('・') || '確認中';
  const count = warnings.length > 0 ? warnings.length : evEvents.length;
  return {
    id: 'landslide',
    icon: '⛰',
    title: '土砂災害警戒情報',
    level: hasEmergency ? 4 : 3,
    evacLevel: hasEmergency ? 4 : 3,
    status: `${count} 件発令中 ／ ${areas}`,
    detail: hasEmergency
      ? '土砂災害緊急警戒情報が発令されています。命に危険が及ぶ状況です。即時避難が必要です。'
      : '土砂災害警戒情報が発令されています。崖崩れ・土石流の危険があります。要配慮者は避難を開始してください。',
    actions: hasEmergency
      ? ['【全員避難】今すぐ崖・沢・渓流から離れる', '指定避難場所へ速やかに移動', '浸水路・危険経路を避けて避難', '自治体の緊急情報に即座に従う']
      : ['【要配慮者避難開始】高齢者・障害者は先行避難', '山際・渓流沿いの移動を中止', '避難場所・経路を家族で再確認', '土砂の異音・匂い・濁流で即避難'],
  };
}

function buildTsunamiReport(events: DisasterEvent[]): SituationReport | null {
  const tsunamis = events.filter((e) => e.type === 'tsunami');
  if (tsunamis.length === 0) return null;
  const worst = tsunamis.reduce((a, b) => {
    const rank = { emergency: 4, warning: 3, advisory: 2, info: 1 } as const;
    return rank[a.severity] >= rank[b.severity] ? a : b;
  });
  const level: DangerLevel =
    worst.severity === 'emergency' ? 5
    : worst.severity === 'warning'  ? 4
    : worst.severity === 'advisory' ? 3
    : 2;
  const evacLevel: EvacLevel = level >= 4 ? 4 : level === 3 ? 3 : 2;
  return {
    id: 'tsunami',
    icon: '🌊',
    title: '津波情報',
    level,
    evacLevel,
    status: `${tsunamis.length} 件 ／ ${worst.title}`,
    detail: level >= 4
      ? '大津波警報が発令されています。沿岸・河川沿いから直ちに高台へ避難してください。車の使用は避け、徒歩で高台を目指してください。'
      : level === 3
      ? '津波警報が発令されています。海岸・河口付近から直ちに離れ、高台または津波避難ビルへ移動してください。'
      : '津波注意報が発令されています。海水浴・釣り等の沿岸活動は直ちに中止し、海から離れてください。',
    actions: level >= 4
      ? ['【全員避難】今すぐ高台・津波避難ビルへ', '海岸・河川沿い・低地から直ちに離れる', '車は使わず徒歩で高台を目指す', '警報解除まで海に近づかない']
      : level === 3
      ? ['【要配慮者避難開始】沿岸から離れ高台へ', '河口・防波堤付近には近づかない', '津波避難ビルを確認しておく', '次の情報を待ちながら高台で待機']
      : ['【避難準備】海岸から離れ高い場所に移動', '釣り・海水浴は即時中止', '津波情報の変化に注意', '注意報解除まで沿岸に戻らない'],
  };
}

function buildHazardReport(isActive: boolean): SituationReport | null {
  if (!isActive) return null;
  return {
    id: 'hazard',
    icon: '🗺',
    title: 'ハザードマップ',
    level: 1,
    evacLevel: 1,
    status: '洪水浸水想定区域（想定最大規模）表示中',
    detail: '色が濃いほど浸水深が深いことを示します（最大10m超）。現在の脅威ではなく平常時の事前確認用マップです。お住まいの浸水リスクを把握してください。',
    actions: ['【様子見】自宅・職場の浸水深を地図で確認', '浸水深2m超エリアは2階以上への垂直避難も検討', '最寄りの避難場所と経路を事前に把握', '家族の緊急連絡先・集合場所を決めておく'],
  };
}

// ────────────────────────────────────────────────
// UI サブコンポーネント
// ────────────────────────────────────────────────
function LevelBadge({ level }: { level: DangerLevel }) {
  const m = LEVEL_META[level];
  return (
    <span
      style={{
        background: m.bg,
        border: `1px solid ${m.color}`,
        color: m.color,
        fontSize: 7,
        letterSpacing: '0.14em',
        padding: '1px 5px',
        fontFamily: 'var(--font-geist-mono, monospace)',
        flexShrink: 0,
      }}
    >
      {m.label}
    </span>
  );
}

function EvacLevelBar({ evacLevel }: { evacLevel: EvacLevel }) {
  const em = EVAC_META[evacLevel];
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        background: em.bg,
        border: `1px solid ${em.border}`,
        padding: '4px 7px',
        marginTop: 5,
      }}
    >
      {/* 4段階インジケーター */}
      <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
        {([1, 2, 3, 4] as EvacLevel[]).map((lv) => {
          const filled = lv <= evacLevel;
          const c = EVAC_META[lv].color;
          return (
            <span
              key={lv}
              style={{
                width: 10,
                height: 10,
                background: filled ? c : 'transparent',
                border: `1px solid ${filled ? c : 'rgba(255,255,255,0.2)'}`,
                display: 'inline-block',
                flexShrink: 0,
              }}
            />
          );
        })}
      </div>

      {/* ラベル */}
      <div style={{ flex: 1 }}>
        <div style={{ color: em.color, fontSize: 8, fontWeight: 700, letterSpacing: '0.12em', lineHeight: 1.2 }}>
          {em.label}
        </div>
        <div style={{ color: em.color, fontSize: 7, opacity: 0.85, letterSpacing: '0.08em', lineHeight: 1.2 }}>
          {em.sublabel}
        </div>
      </div>

      {/* アイコン */}
      <span
        style={{
          color: em.color,
          fontSize: evacLevel === 4 ? 10 : 9,
          fontWeight: 700,
          fontFamily: 'monospace',
          flexShrink: 0,
          ...(evacLevel === 4 ? { animation: 'cp-pulse-opacity 1s ease-in-out infinite' } : {}),
        }}
      >
        {em.icon}
      </span>
    </div>
  );
}

function ReportCard({
  report,
  accent,
  highlighted = false,
}: {
  report: SituationReport;
  accent: string;
  highlighted?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const m = LEVEL_META[report.level];

  // イベント選択時: 自動展開 + スクロール
  useEffect(() => {
    if (highlighted) {
      setExpanded(true);
      cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [highlighted]);

  return (
    <div
      ref={cardRef}
      style={{
        borderLeft: `2px solid ${highlighted ? '#00e5ff' : m.color}`,
        background: highlighted ? 'rgba(0,229,255,0.08)' : m.bg,
        marginBottom: 6,
        padding: '6px 8px',
        boxShadow: highlighted ? '0 0 8px rgba(0,229,255,0.25)' : 'none',
        transition: 'box-shadow 0.2s, background 0.2s',
      }}
    >
      {/* ヘッダー行 */}
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          width: '100%',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          textAlign: 'left',
        }}
      >
        <LevelBadge level={report.level} />
        <span style={{ color: 'var(--cp-text)', fontSize: 9, fontWeight: 600, letterSpacing: '0.1em', flex: 1 }}>
          {report.title}
        </span>
        <span style={{ color: 'var(--cp-muted)', fontSize: 8 }}>{expanded ? '▲' : '▼'}</span>
      </button>

      {/* 現状 */}
      <div style={{ color: m.color, fontSize: 8, marginTop: 3, letterSpacing: '0.05em' }}>
        {report.status}
      </div>

      {/* 避難レベルバー（常時表示） */}
      <EvacLevelBar evacLevel={report.evacLevel} />

      {/* 展開: 解説 + 避難対応 */}
      {expanded && (
        <div style={{ marginTop: 6 }}>
          <div
            style={{
              color: 'var(--cp-muted)',
              fontSize: 8,
              lineHeight: 1.6,
              letterSpacing: '0.04em',
              marginBottom: 6,
            }}
          >
            {report.detail}
          </div>
          <div style={{ color: EVAC_META[report.evacLevel].color, fontSize: 7, letterSpacing: '0.12em', marginBottom: 4 }}>
            ▶ 避難対応方針
          </div>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {report.actions.map((a, i) => (
              <li
                key={i}
                style={{
                  color: 'var(--cp-text)',
                  fontSize: 8,
                  lineHeight: 1.6,
                  letterSpacing: '0.04em',
                  paddingLeft: 10,
                  position: 'relative',
                  marginBottom: 2,
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    left: 0,
                    color: EVAC_META[report.evacLevel].color,
                    fontSize: 7,
                  }}
                >
                  ›
                </span>
                {a}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────
// メインコンポーネント
// ────────────────────────────────────────────────
export function SituationPanel({
  isMobile = false,
  onOpenChange,
}: {
  isMobile?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(() =>
    typeof window === 'undefined' ? true : !window.matchMedia('(max-width: 1023px)').matches
  );

  const toggleOpen = (v: boolean) => {
    setOpen(v);
    onOpenChange?.(v);
  };

  const layers           = useDisasterStore((s) => s.layers);
  const events           = useDisasterStore((s) => s.events);
  const typhoons         = useDisasterStore((s) => s.typhoons);
  const linearPrecipBands = useDisasterStore((s) => s.linearPrecipBands);
  const landslideWarnings = useDisasterStore((s) => s.landslideWarnings);
  const selectedEvent    = useDisasterStore((s) => s.selectedEvent);

  const highlightedReportId = selectedEvent
    ? (EVENT_TYPE_TO_REPORT_ID[selectedEvent.type] ?? null)
    : null;

  // ヘッダーバッジ cycling state（Rules of Hooks: early return より前）
  const [displayIdx, setDisplayIdx] = useState(0);
  const [badgeFade, setBadgeFade]   = useState(true);

  const reports: SituationReport[] = [
    buildEarthquakeReport(events),
    buildTyphoonReport(typhoons),
    buildLinearPrecipReport(linearPrecipBands, events),
    buildLandslideReport(landslideWarnings, events),
    buildTsunamiReport(events),
    buildRainReport(layers.rain),
    buildThunderReport(layers.thunder),
    buildHazardReport(layers.hazard),
  ].filter((r): r is SituationReport => r !== null);

  // イベント選択時にパネルを自動展開
  useEffect(() => {
    if (highlightedReportId) toggleOpen(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightedReportId]);

  // ローテーションタイマー
  useEffect(() => {
    if (reports.length <= 1) return;
    const cycle = () => {
      setBadgeFade(false);
      setTimeout(() => {
        setDisplayIdx((i) => (i + 1) % reports.length);
        setBadgeFade(true);
      }, 300);
    };
    const id = setInterval(cycle, 3500);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reports.length]);

  // 選択イベント → 対応するレポートへジャンプ
  useEffect(() => {
    if (!highlightedReportId) return;
    const idx = reports.findIndex((r) => r.id === highlightedReportId);
    if (idx >= 0) {
      setBadgeFade(false);
      setTimeout(() => { setDisplayIdx(idx); setBadgeFade(true); }, 150);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightedReportId]);

  if (reports.length === 0) return null;

  // 全体の最高危険レベル
  const maxLevel = reports.reduce<DangerLevel>((m, r) => (r.level > m ? r.level : m), 1);
  const maxMeta  = LEVEL_META[maxLevel];

  const safeIdx         = Math.min(displayIdx, reports.length - 1);
  const displayReport   = reports[safeIdx];
  const displayEvacMeta = EVAC_META[displayReport.evacLevel];

  return (
    <div
      data-mobile={isMobile ? 'true' : undefined}
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        pointerEvents: 'auto',
      }}
    >
      {/* ヘッダー */}
      <button
        onClick={() => toggleOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          width: '100%',
          background: 'rgba(6,8,18,0.92)',
          border: `1px solid ${maxMeta.color}`,
          color: maxMeta.color,
          fontSize: 8,
          letterSpacing: '0.2em',
          padding: '4px 8px',
          cursor: 'pointer',
          fontFamily: 'var(--font-geist-mono, monospace)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <span style={{ fontSize: 7, opacity: 0.7 }}>◉</span>
        <span>SITUATION REPORT</span>
        <div
          style={{
            marginLeft: 'auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: 1,
            opacity: badgeFade ? 1 : 0,
            transition: 'opacity 0.3s ease',
          }}
        >
          <span
            style={{
              background: displayEvacMeta.bg,
              color: displayEvacMeta.color,
              border: `1px solid ${displayEvacMeta.border}`,
              fontSize: 7,
              padding: '1px 5px',
              letterSpacing: '0.08em',
              fontWeight: 700,
              whiteSpace: 'nowrap',
            }}
          >
            避難LV.{displayReport.evacLevel} {displayEvacMeta.sublabel}
          </span>
          <span style={{ color: 'var(--cp-muted)', fontSize: 6, letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>
            {displayReport.title}
          </span>
        </div>
        <span style={{ fontSize: 7, opacity: 0.6 }}>{open ? '▲' : '▼'}</span>
      </button>

      {/* パネル本体 */}
      {open && (
        <div
          style={{
            background: 'rgba(6,8,18,0.92)',
            border: `1px solid var(--cp-border)`,
            borderTop: 'none',
            backdropFilter: 'blur(8px)',
            flex: '1 1 auto',
            overflowY: 'auto',
            minHeight: 0,
            position: 'relative',
          }}
        >
          {/* スキャンライン */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage:
                'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,255,255,0.01) 3px, rgba(0,255,255,0.01) 4px)',
              pointerEvents: 'none',
              zIndex: 0,
            }}
          />

          <div style={{ padding: '8px 8px 6px', position: 'relative', zIndex: 1 }}>
            {/* 全体サマリー行 */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 6,
                paddingBottom: 5,
                borderBottom: '1px solid var(--cp-border)',
              }}
            >
              <span style={{ color: 'var(--cp-muted)', fontSize: 7, letterSpacing: '0.1em' }}>
                {reports.length} 件の状況を監視中
              </span>
              <span style={{ color: 'var(--cp-muted)', fontSize: 7 }}>
                各項目をタップで展開
              </span>
            </div>

            {/* レポートカード一覧 */}
            {reports.map((r) => (
              <ReportCard
                key={r.id}
                report={r}
                accent={maxMeta.color}
                highlighted={r.id === highlightedReportId}
              />
            ))}

            {/* フッター */}
            <div
              style={{
                paddingTop: 4,
                borderTop: '1px solid var(--cp-border)',
                color: 'var(--cp-muted)',
                fontSize: 7,
                letterSpacing: '0.05em',
              }}
            >
              情報は参考です。公式発表・自治体指示を最優先してください。
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
