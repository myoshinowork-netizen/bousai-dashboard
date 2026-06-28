'use client';

import { useMemo } from 'react';
import { useDisasterStore } from '@/store/useDisasterStore';

// ────────────────────────────────────────────────
// 自然文センテンス生成
// ────────────────────────────────────────────────
function formatHM(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function buildSentences(
  events: ReturnType<typeof useDisasterStore.getState>['events'],
  typhoons: ReturnType<typeof useDisasterStore.getState>['typhoons'],
  linearPrecipBands: ReturnType<typeof useDisasterStore.getState>['linearPrecipBands'],
  landslideWarnings: ReturnType<typeof useDisasterStore.getState>['landslideWarnings'],
  layers: ReturnType<typeof useDisasterStore.getState>['layers'],
): { text: string; color: string }[] {
  const out: { text: string; color: string }[] = [];
  const RED  = '#ff1744';
  const ORG  = '#ff6d00';
  const YEL  = '#ffd600';
  const CYN  = '#00e5ff';
  const MUT  = '#78909c';

  // ── 地震 ─────────────────────────────────────
  const quakes = events.filter((e) => e.type === 'earthquake');
  if (quakes.length > 0) {
    const recent = [...quakes].sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
    const latest = recent[0];
    const mag    = latest.title.match(/M[\d.]+/)?.[0] ?? '';
    const area   = latest.area?.[0] ?? latest.title.slice(0, 12);
    const time   = formatHM(latest.occurredAt);
    const h1count = recent.filter((e) => Date.now() - new Date(e.occurredAt).getTime() < 3600_000).length;
    const color  = latest.severity === 'emergency' ? RED : latest.severity === 'warning' ? ORG : latest.severity === 'advisory' ? YEL : MUT;

    out.push({ text: `⚡ ${time}頃、${area}で${mag}の地震が発生しました。`, color });
    if (h1count > 1) out.push({ text: `⚡ 直近1時間に地震が${h1count}件発生しています。余震に引き続きご注意ください。`, color });
    if (latest.severity === 'emergency') {
      out.push({ text: `⚡【緊急】強い揺れが観測されています。津波の可能性を確認し、速やかに安全な場所へ避難してください。`, color: RED });
    } else if (latest.severity === 'warning') {
      out.push({ text: `⚡ 有感地震が続いています。高齢者・障害者など要配慮者は今のうちに避難を開始してください。`, color: ORG });
    }
  }

  // ── 津波 ─────────────────────────────────────
  const tsunamis = events.filter((e) => e.type === 'tsunami');
  if (tsunamis.length > 0) {
    const worst = tsunamis.reduce((a, b) =>
      ({ emergency: 4, warning: 3, advisory: 2, info: 1 }[a.severity] >= { emergency: 4, warning: 3, advisory: 2, info: 1 }[b.severity] ? a : b));
    const area  = worst.area?.slice(0, 2).join('・') ?? '';
    const color = worst.severity === 'emergency' ? RED : worst.severity === 'warning' ? ORG : YEL;
    out.push({ text: `🌊 津波${worst.severity === 'emergency' ? '警報（大津波）' : worst.severity === 'warning' ? '警報' : '注意報'}が発令中${area ? `（${area}）` : ''}。沿岸・河口付近からただちに離れてください。`, color });
    if (worst.severity !== 'info') {
      out.push({ text: `🌊【${worst.severity === 'emergency' ? '全員避難' : '要配慮者避難'}】海岸・低地から高台または津波避難ビルへ移動してください。`, color });
    }
  }

  // ── 台風 ─────────────────────────────────────
  const activeTy = typhoons.filter((t) => ['TY', 'STS', 'TS'].includes(t.category));
  if (activeTy.length > 0) {
    const catLabel: Record<string, string> = { TY: '台風', STS: '強熱帯暴風雨', TS: '熱帯暴風雨', TD: '熱帯低気圧' };
    activeTy.forEach((t) => {
      const cat   = catLabel[t.category] ?? '台風';
      const p     = t.pressureHPa ? `（中心気圧 ${t.pressureHPa}hPa）` : '';
      const color = t.pressureHPa && t.pressureHPa < 950 ? RED : t.pressureHPa && t.pressureHPa < 970 ? ORG : YEL;
      out.push({ text: `🌀 ${cat}「${t.name}」${p}が現在活動中です。今後の進路・勢力の変化に十分ご注意ください。`, color });
      if (t.pressureHPa && t.pressureHPa < 950) {
        out.push({ text: `🌀【避難準備】非常に強い${cat}が接近しています。暴風到達前に安全な場所へ避難を完了させてください。`, color: RED });
      }
    });
    const allTy = typhoons.filter((t) => ['TY', 'STS', 'TS', 'TD', 'ET'].includes(t.category));
    if (allTy.length > activeTy.length) {
      out.push({ text: `🌀 その他 ${allTy.length - activeTy.length}件の熱帯低気圧・温帯低気圧が発生しています。動向を継続監視中です。`, color: MUT });
    }
  }

  // ── 線状降水帯 ────────────────────────────────
  const lpBands  = linearPrecipBands;
  const lpEvents = events.filter((e) => e.type === 'linear_precip');
  if (lpBands.length > 0 || lpEvents.length > 0) {
    const count = lpBands.length > 0 ? lpBands.length : lpEvents.length;
    const areas = lpBands.length > 0
      ? lpBands.map((b) => b.area).slice(0, 3).join('・')
      : [...new Set(lpEvents.flatMap((e) => e.area ?? []))].slice(0, 3).join('・') || '複数地域';
    out.push({ text: `⛈ 線状降水帯が${areas}で${count}件発生しています。極めて激しい雨が継続中です。`, color: RED });
    out.push({ text: `⛈【全員避難】河川・崖・低地からただちに離れ、安全な高所へ避難してください。`, color: RED });
  }

  // ── 土砂災害 ─────────────────────────────────
  const lsWarnings = landslideWarnings;
  const lsEvents   = events.filter((e) => e.type === 'landslide');
  if (lsWarnings.length > 0 || lsEvents.length > 0) {
    const count = lsWarnings.length > 0 ? lsWarnings.length : lsEvents.length;
    const areas = lsWarnings.length > 0
      ? [...new Set(lsWarnings.map((w) => w.prefecture))].slice(0, 3).join('・')
      : [...new Set(lsEvents.flatMap((e) => e.area ?? []))].slice(0, 3).join('・') || '複数地域';
    const isEmerg = lsWarnings.some((w) => w.level === 'emergency') || lsEvents.some((e) => e.severity === 'emergency');
    out.push({ text: `⛰ 土砂災害${isEmerg ? '緊急' : ''}警戒情報が${areas}など${count}件発令中です。`, color: isEmerg ? RED : ORG });
    if (isEmerg) {
      out.push({ text: `⛰【緊急】崖・沢・渓流付近から今すぐ離れ、指定避難場所へ移動してください。`, color: RED });
    } else {
      out.push({ text: `⛰ 山際・渓流沿いへの移動を中止し、避難場所・経路を今のうちに確認してください。`, color: ORG });
    }
  }

  // ── 洪水 ─────────────────────────────────────
  const floods = events.filter((e) => e.type === 'flood');
  if (floods.length > 0) {
    const areas = [...new Set(floods.flatMap((e) => e.area ?? []))].slice(0, 3).join('・') || '複数地域';
    out.push({ text: `💧 洪水警報が${areas}で発令中。河川の増水・氾濫に十分注意してください。`, color: ORG });
  }

  // ── 雨雲レーダー ─────────────────────────────
  if (layers.rain) {
    out.push({ text: `🌧 現在、雨雲レーダーをリアルタイム監視中（5分更新）。赤・紫の強雨エリアでは急激な増水の恐れがあります。`, color: CYN });
  }

  // ── 雷 ───────────────────────────────────────
  if (layers.thunder) {
    out.push({ text: `⚡ 雷ナウキャストを監視中。落雷活動が活発な地域では屋外活動を中断し、丈夫な建物・車内に退避してください。`, color: YEL });
  }

  // ── ハザードマップ ────────────────────────────
  if (layers.hazard) {
    out.push({ text: `💧 洪水浸水想定区域（ハザードマップ）を表示中。色が濃いほど浸水リスクが高い地域です。平常時から避難場所・経路を確認してください。`, color: CYN });
  }

  // ── 土砂危険箇所 ──────────────────────────────
  if (layers.landslide) {
    out.push({ text: `⛰ 急傾斜地崩壊危険箇所（土砂災害警戒区域）を表示中。赤ゾーンは特別警戒区域です。`, color: CYN });
  }

  // ── 何もなければ ─────────────────────────────
  if (out.length === 0) {
    out.push({ text: `✅ 現在、重大な気象・地震情報は発令されていません。引き続き最新の防災情報を確認してください。`, color: MUT });
    out.push({ text: `📋 非常持ち出し品・避難場所・家族との連絡手段を日頃から確認しておきましょう。`, color: MUT });
  }

  return out;
}

// ────────────────────────────────────────────────
// コンポーネント
// ────────────────────────────────────────────────
export function NewsTicker({ onOpenModal }: { onOpenModal: () => void }) {
  const events            = useDisasterStore((s) => s.events);
  const typhoons          = useDisasterStore((s) => s.typhoons);
  const linearPrecipBands = useDisasterStore((s) => s.linearPrecipBands);
  const landslideWarnings = useDisasterStore((s) => s.landslideWarnings);
  const layers            = useDisasterStore((s) => s.layers);

  const sentences = useMemo(
    () => buildSentences(events, typhoons, linearPrecipBands, landslideWarnings, layers),
    [events, typhoons, linearPrecipBands, landslideWarnings, layers],
  );

  // 最高レベルの色をラベルに使用
  const accentColor = sentences[0]?.color ?? '#546e7a';

  // 区切り記号付きで1本の文字列に
  const tickerText = sentences.map((s) => s.text).join('　　◆　　');

  // アニメーション時間 = 文字数 × 0.18s（長すぎず短すぎず）
  const duration = Math.max(30, tickerText.length * 0.18);

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
        zIndex: 5,
      }}
    >
      {/* ラベル */}
      <div
        style={{
          flexShrink: 0,
          background: accentColor,
          color: accentColor === '#546e7a' ? '#fff' : '#000',
          fontSize: 8,
          fontWeight: 700,
          letterSpacing: '0.12em',
          padding: '0 8px',
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
          maskImage: 'linear-gradient(to right, transparent 0%, black 3%, black 97%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 3%, black 97%, transparent 100%)',
        }}
      >
        <div
          key={tickerText}
          style={{
            display: 'inline-block',
            whiteSpace: 'nowrap',
            color: 'var(--cp-text)',
            fontSize: 10,
            letterSpacing: '0.03em',
            lineHeight: '28px',
            animation: `ticker-scroll ${duration}s linear infinite`,
            paddingLeft: '100%',
          }}
        >
          {/* カラー装飾付きテキスト */}
          {sentences.map((s, i) => (
            <span key={i}>
              <span style={{ color: s.color }}>{s.text}</span>
              {i < sentences.length - 1 && (
                <span style={{ color: 'var(--cp-border)', padding: '0 1.5em' }}>◆</span>
              )}
            </span>
          ))}
          {/* ループ用スペーサー */}
          <span style={{ paddingRight: '6em' }} />
          {sentences.map((s, i) => (
            <span key={`r${i}`}>
              <span style={{ color: s.color }}>{s.text}</span>
              {i < sentences.length - 1 && (
                <span style={{ color: 'var(--cp-border)', padding: '0 1.5em' }}>◆</span>
              )}
            </span>
          ))}
        </div>
      </div>

      {/* 詳細ボタン */}
      <button
        onClick={onOpenModal}
        style={{
          flexShrink: 0,
          background: 'rgba(0,229,255,0.1)',
          border: '1px solid rgba(0,229,255,0.5)',
          borderTop: 'none',
          borderBottom: 'none',
          color: 'var(--cp-cyan)',
          fontSize: 8,
          letterSpacing: '0.12em',
          padding: '0 10px',
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
