'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useDisasterStore } from '@/store/useDisasterStore';
import type { ForecastDay } from '@/lib/model';

// ────────────────────────────────────────────────
// 自然文センテンス生成
// ────────────────────────────────────────────────
function formatHM(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const DAY_JA = ['日', '月', '火', '水', '木', '金', '土'];

function buildSentences(
  events: ReturnType<typeof useDisasterStore.getState>['events'],
  typhoons: ReturnType<typeof useDisasterStore.getState>['typhoons'],
  linearPrecipBands: ReturnType<typeof useDisasterStore.getState>['linearPrecipBands'],
  landslideWarnings: ReturnType<typeof useDisasterStore.getState>['landslideWarnings'],
  layers: ReturnType<typeof useDisasterStore.getState>['layers'],
  forecastDays: ForecastDay[],
): { text: string; color: string }[] {
  const out: { text: string; color: string }[] = [];
  const RED = '#ff1744';
  const ORG = '#ff6d00';
  const YEL = '#ffd600';
  const CYN = '#00e5ff';
  const GRN = '#69f0ae';
  const MUT = '#78909c';

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
    const withTsunami = recent.find((e) => e.title.includes('津波'));
    if (withTsunami) {
      out.push({ text: `🌊 この地震に伴い津波警報・注意報が発令されています。沿岸・河口付近からただちに離れてください。`, color: RED });
    }
  }

  // ── 津波 ─────────────────────────────────────
  const tsunamis = events.filter((e) => e.type === 'tsunami');
  if (tsunamis.length > 0) {
    const sevScore: Record<string, number> = { emergency: 4, warning: 3, advisory: 2, info: 1 };
    const worst = tsunamis.reduce((a, b) => sevScore[a.severity] >= sevScore[b.severity] ? a : b);
    const area  = worst.area?.slice(0, 2).join('・') ?? '';
    const color = worst.severity === 'emergency' ? RED : worst.severity === 'warning' ? ORG : YEL;
    out.push({ text: `🌊 津波${worst.severity === 'emergency' ? '警報（大津波）' : worst.severity === 'warning' ? '警報' : '注意報'}が発令中${area ? `（${area}）` : ''}。沿岸・河口付近からただちに離れてください。`, color });
    out.push({ text: `🌊【${worst.severity === 'emergency' ? '全員避難' : '要配慮者避難'}】海岸・低地から高台または津波避難ビルへ移動してください。`, color });
  }

  // ── 台風 ─────────────────────────────────────
  const activeTy = typhoons.filter((t) => ['TY', 'STS', 'TS'].includes(t.category));
  if (activeTy.length > 0) {
    const catLabel: Record<string, string> = { TY: '台風', STS: '強熱帯暴風雨', TS: '熱帯暴風雨', TD: '熱帯低気圧' };
    activeTy.forEach((t) => {
      const cat   = catLabel[t.category] ?? '台風';
      const p     = t.pressureHPa ? `（中心気圧 ${t.pressureHPa}hPa / 最大風速 ${t.maxWindKt}kt）` : '';
      const color = t.pressureHPa && t.pressureHPa < 950 ? RED : t.pressureHPa && t.pressureHPa < 970 ? ORG : YEL;
      out.push({ text: `🌀 ${cat}「${t.name}」${p}が活動中です。今後の進路・勢力変化に十分ご注意ください。`, color });
      if (t.pressureHPa && t.pressureHPa < 950) {
        out.push({ text: `🌀【避難準備】非常に強い${cat}が接近しています。暴風到達前に安全な場所へ避難を完了させてください。`, color: RED });
      }
      const forecastPt = t.track.filter((p) => p.forecast)[0];
      if (forecastPt) {
        const d = new Date(forecastPt.time);
        out.push({ text: `🌀 台風は${d.getMonth()+1}/${d.getDate()}（${DAY_JA[d.getDay()]}）頃にかけて北上する見込みです。暴風・高潮・土砂災害への備えを急いでください。`, color });
      }
    });
    const allTy = typhoons.filter((t) => ['TY', 'STS', 'TS', 'TD', 'ET'].includes(t.category));
    if (allTy.length > activeTy.length) {
      out.push({ text: `🌀 その他 ${allTy.length - activeTy.length}件の熱帯低気圧・温帯低気圧を継続監視中です。`, color: MUT });
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
    out.push({ text: `⛈ 線状降水帯が${areas}で${count}件発生中。極めて激しい雨が継続し、河川増水・土砂崩れの危険が急激に高まっています。`, color: RED });
    out.push({ text: `⛈【全員避難】河川・崖・低地からただちに離れ、安全な高所へ避難してください。外出を控え、すでに安全な場所にいる方はそのままお待ちください。`, color: RED });
  }

  // ── 大雨・洪水警報 ────────────────────────────
  const rainEvents  = events.filter((e) => e.type === 'rain');
  const floodEvents = events.filter((e) => e.type === 'flood');
  if (rainEvents.length > 0) {
    const areas = [...new Set(rainEvents.flatMap((e) => e.area ?? []))].slice(0, 3).join('・') || '複数地域';
    const isEmerg = rainEvents.some((e) => e.severity === 'emergency');
    out.push({ text: `🌧 ${isEmerg ? '大雨特別警報' : '大雨警報'}が${areas}で発令中。数十年に一度の猛烈な雨になる可能性があります。`, color: isEmerg ? RED : ORG });
  }
  if (floodEvents.length > 0) {
    const areas = [...new Set(floodEvents.flatMap((e) => e.area ?? []))].slice(0, 3).join('・') || '複数地域';
    out.push({ text: `💧 洪水警報が${areas}で発令中。河川の増水・氾濫の危険があります。河川付近への立ち入りを控えてください。`, color: ORG });
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
    out.push({ text: `⛰ 土砂災害${isEmerg ? '緊急' : ''}警戒情報が${areas}など${count}件発令中。山際・渓流沿いの方は今すぐ避難を。`, color: isEmerg ? RED : ORG });
    if (!isEmerg) {
      out.push({ text: `⛰ 山際・渓流沿いへの移動を中止し、避難場所・経路を今のうちに確認してください。`, color: ORG });
    }
  }

  // ── 雷注意報 ─────────────────────────────────
  const thunderEvents = events.filter((e) => e.type === 'thunder');
  if (layers.thunder || thunderEvents.length > 0) {
    if (thunderEvents.length > 0) {
      const areas = [...new Set(thunderEvents.flatMap((e) => e.area ?? []))].slice(0, 3).join('・');
      out.push({ text: `⚡ 雷注意報が${areas}に発令中。落雷・突風・急な大雨に注意し、屋外活動は控えめに。`, color: YEL });
    } else {
      out.push({ text: `⚡ 雷ナウキャストを監視中。落雷活動が活発な地域では屋外活動を中断し、丈夫な建物・車内に退避してください。`, color: YEL });
    }
  }

  // ── ハザードマップ・レイヤー情報 ─────────────
  if (layers.rain && !layers.thunder) {
    out.push({ text: `🌧 雨雲レーダーをリアルタイム監視中（5分更新）。赤・紫の強雨エリアでは急激な増水の恐れがあります。`, color: CYN });
  }
  if (layers.hazard) {
    out.push({ text: `💧 洪水浸水想定区域（ハザードマップ）を表示中。色が濃いほど浸水リスクが高い地域です。平常時から避難場所・経路を確認しておきましょう。`, color: CYN });
  }
  if (layers.landslide) {
    out.push({ text: `⛰ 急傾斜地崩壊危険箇所（土砂災害警戒区域）を表示中。赤ゾーンは特別警戒区域です。`, color: CYN });
  }

  // ── 今日の天気予報 ────────────────────────────
  if (forecastDays.length > 0) {
    const today = forecastDays[0];
    const tMax  = today.tempMax;
    const tMin  = today.tempMin;
    const pop   = today.popMax ?? 0;
    const tempStr = (tMax !== undefined && tMin !== undefined)
      ? `最高${tMax}°・最低${tMin}°`
      : tMax !== undefined ? `最高${tMax}°` : '';
    const popStr  = pop > 0 ? `降水確率${pop}%` : '';
    const parts   = [tempStr, popStr].filter(Boolean).join('、');
    const color   = pop >= 70 ? ORG : pop >= 40 ? YEL : GRN;
    out.push({ text: `🌤 今日の天気: ${today.weather}${parts ? `（${parts}）` : ''}`, color });

    // 週間見立て
    const rest = forecastDays.slice(1, 5);
    if (rest.length >= 2) {
      const rainDays = rest.filter((d) => (d.popMax ?? 0) >= 60);
      const maxTemp  = rest.reduce<number | undefined>((m, d) =>
        d.tempMax !== undefined ? (m === undefined ? d.tempMax : Math.max(m, d.tempMax)) : m, undefined);
      if (rainDays.length === 0 && maxTemp !== undefined) {
        out.push({ text: `📅 今週の見立て: 比較的安定した天気が続く見込みです。最高気温は${maxTemp}°前後。熱中症や紫外線対策をお忘れなく。`, color: GRN });
      } else if (rainDays.length >= 3) {
        out.push({ text: `📅 今週の見立て: 雨天日が多く不安定な天気が続く見込みです。低地・河川沿いにお住まいの方は早めの備えを。`, color: YEL });
      } else if (rainDays.length > 0) {
        const dayNames = rainDays.slice(0, 2).map((d) => {
          const dt = new Date(d.date);
          return `${dt.getMonth()+1}/${dt.getDate()}（${DAY_JA[dt.getDay()]}）`;
        }).join('・');
        out.push({ text: `📅 今週の見立て: ${dayNames}を中心に降水確率が高い見込みです。外出・行楽の計画は最新予報をご確認ください。`, color: YEL });
      }
    }
  }

  // ── 何もなければ ─────────────────────────────
  if (out.length === 0) {
    out.push({ text: `✅ 現在、重大な気象・地震情報は発令されていません。引き続き最新の防災情報を確認してください。`, color: MUT });
    out.push({ text: `📋 非常持ち出し品・避難場所・家族との連絡手段を日頃から確認しておきましょう。`, color: MUT });
    out.push({ text: `📋 ハザードマップで自宅周辺の浸水・土砂リスクを確認し、いざという時の避難経路を家族で共有しておきましょう。`, color: MUT });
  }

  return out;
}

// ────────────────────────────────────────────────
// RAF ベースのシームレスループトラック
//
// CSS animation の key リセットや animation-duration 変更による
// アニメーション再起動を完全に回避するため、requestAnimationFrame で
// 位置を自前管理する。コンテンツが更新されても position が継続される。
// ────────────────────────────────────────────────
const SPEED_PX = 55; // px / 秒

function TickerTrack({ sentences }: { sentences: { text: string; color: string }[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const posRef   = useRef(0);
  const rafRef   = useRef<number | null>(null);

  useEffect(() => {
    let lastTime: number | null = null;

    function tick(now: number) {
      const track = trackRef.current;
      if (!track) { rafRef.current = requestAnimationFrame(tick); return; }

      if (lastTime !== null) {
        const dt      = (now - lastTime) / 1000;
        const singleW = track.scrollWidth / 2; // 2コピー分なので割る2が1コピーの幅

        posRef.current += SPEED_PX * dt;
        if (singleW > 0 && posRef.current >= singleW) {
          // モジュロ演算でシームレスにループ
          posRef.current = posRef.current % singleW;
        }

        track.style.transform = `translateX(${-posRef.current}px)`;
      }

      lastTime = now;
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []); // マウント時1回のみ。sentences の変化は DOM 差分更新で吸収

  return (
    <div
      ref={trackRef}
      style={{ display: 'inline-flex', whiteSpace: 'nowrap', willChange: 'transform' }}
    >
      {/* 2コピーを並べてシームレスループを実現 */}
      {[0, 1].map((copyIdx) => (
        <span
          key={copyIdx}
          aria-hidden={copyIdx === 1 ? true : undefined}
          style={{ display: 'inline-flex', alignItems: 'center' }}
        >
          {sentences.map((s, i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center' }}>
              <span style={{ color: s.color, lineHeight: '28px' }}>{s.text}</span>
              <span style={{ color: 'rgba(232,16,42,0.35)', padding: '0 1.8em', lineHeight: '28px' }}>◆</span>
            </span>
          ))}
        </span>
      ))}
    </div>
  );
}

// ────────────────────────────────────────────────
// メインコンポーネント
// ────────────────────────────────────────────────
export function NewsTicker({ onOpenModal }: { onOpenModal: () => void }) {
  const events            = useDisasterStore((s) => s.events);
  const typhoons          = useDisasterStore((s) => s.typhoons);
  const linearPrecipBands = useDisasterStore((s) => s.linearPrecipBands);
  const landslideWarnings = useDisasterStore((s) => s.landslideWarnings);
  const layers            = useDisasterStore((s) => s.layers);
  const forecastDays      = useDisasterStore((s) => s.forecastDays);

  const sentences = useMemo(
    () => buildSentences(events, typhoons, linearPrecipBands, landslideWarnings, layers, forecastDays),
    [events, typhoons, linearPrecipBands, landslideWarnings, layers, forecastDays],
  );

  const accentColor = sentences[0]?.color ?? '#546e7a';

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
          fontFamily: 'var(--font-mono)',
          whiteSpace: 'nowrap',
          zIndex: 2,
        }}
      >
        速報
      </div>

      {/* スクロールエリア */}
      <div
        style={{
          flex: 1,
          overflow: 'hidden',
          position: 'relative',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          maskImage: 'linear-gradient(to right, transparent 0%, black 2%, black 96%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 2%, black 96%, transparent 100%)',
          fontFamily: 'var(--font-ui)',
          fontSize: 10,
          letterSpacing: '0.03em',
        }}
      >
        <TickerTrack sentences={sentences} />
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
          fontFamily: 'var(--font-mono)',
          whiteSpace: 'nowrap',
          zIndex: 2,
        }}
      >
        詳細 ›
      </button>
    </div>
  );
}
