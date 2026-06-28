'use client';

import { useEffect, useState } from 'react';
import { useDisasterStore } from '@/store/useDisasterStore';
import type { Severity } from '@/lib/model';

// ─── 色・テーマ定義 ────────────────────────────────
const SM = {
  bg:         '#f0f4f8',
  card:       '#ffffff',
  border:     '#d0d8e4',
  text:       '#1a2744',
  textSub:    '#4a5a7a',
  textMuted:  '#7a8aaa',
  shadow:     '0 2px 12px rgba(0,0,0,0.08)',
  shadowHover:'0 4px 20px rgba(0,0,0,0.14)',
};

// ─── 警戒レベル定義 ────────────────────────────────
type AlertDef = {
  label:   string;
  sublabel: string;
  color:   string;
  bg:      string;
  borderColor: string;
  icon:    string;
  meaning: string;
  action:  string[];
  pulse:   boolean;
};

const ALERT_DEFS: Record<'none' | Severity, AlertDef> = {
  none: {
    label: '平常',
    sublabel: '特別な警戒情報なし',
    color:  '#166534',
    bg:     '#dcfce7',
    borderColor: '#86efac',
    icon:   '✅',
    meaning: '現在、特別な災害情報はありません。',
    action: [
      '通常通りお過ごしください',
      'ハザードマップで自宅の危険箇所を確認しておきましょう',
      '非常用持ち出し袋の内容を定期的に確認しましょう',
    ],
    pulse: false,
  },
  info: {
    label: '情報',
    sublabel: '警戒レベル１',
    color:  '#1d4ed8',
    bg:     '#dbeafe',
    borderColor: '#93c5fd',
    icon:   'ℹ️',
    meaning: '気象や地震などに関する情報が発表されています。',
    action: [
      'テレビ・ラジオ・このアプリで最新情報を確認してください',
      '外出を控えることを検討してください',
      '非常用持ち出し袋の準備をしておきましょう',
    ],
    pulse: false,
  },
  advisory: {
    label: '注意',
    sublabel: '警戒レベル２',
    color:  '#92400e',
    bg:     '#fef3c7',
    borderColor: '#fcd34d',
    icon:   '⚠️',
    meaning: '注意が必要な状況になっています。備えを始めてください。',
    action: [
      '避難場所と経路を家族と確認してください',
      '非常用持ち出し袋を手の届く場所に置いてください',
      '高齢者・障がいのある方は早めの避難を検討してください',
      'ハザードマップで自宅の危険度を確認してください',
    ],
    pulse: false,
  },
  warning: {
    label: '警戒',
    sublabel: '警戒レベル３',
    color:  '#9a3412',
    bg:     '#fee2e2',
    borderColor: '#fca5a5',
    icon:   '🚨',
    meaning: '危険な状況です。高齢者や体の不自由な方は今すぐ避難してください。',
    action: [
      '🏃 高齢者・障がいのある方は今すぐ避難してください',
      '📻 市区町村からの避難情報を必ず確認してください',
      '⛈ 川や斜面には近づかないでください',
      '💡 危険を感じたら自主的に避難してください',
    ],
    pulse: false,
  },
  emergency: {
    label: '緊急',
    sublabel: '警戒レベル４〜５',
    color:  '#ffffff',
    bg:     '#991b1b',
    borderColor: '#ef4444',
    icon:   '🆘',
    meaning: '命に危険が迫っています！今すぐ行動してください！',
    action: [
      '🚨 今すぐ安全な場所に避難してください！',
      '⬆️ 垂直避難（上の階へ）か水平避難（遠くへ）を選んでください',
      '🚗 車での移動は危険な場合があります',
      '📞 119番・110番に迷わず連絡してください',
      '👫 一人で判断せず、周囲の人と協力してください',
    ],
    pulse: true,
  },
};

const SEVERITY_ORDER: Record<'none' | Severity, number> = {
  none: 0, info: 1, advisory: 2, warning: 3, emergency: 4,
};

// ─── 天気コード → 絵文字 ──────────────────────────
function weatherEmoji(code: string): string {
  const n = parseInt(code, 10);
  if (n === 100 || n === 101) return '☀️';
  if (n >= 102 && n <= 111) return '⛅';
  if (n >= 200 && n <= 223) return '🌧️';
  if (n >= 300 && n <= 323) return '🌨️';
  if (n >= 400 && n <= 421) return '❄️';
  if (n >= 500 && n <= 550) return '⛈️';
  return '🌤️';
}

// ─── ニュースアイテム型 ────────────────────────────
type NewsItem = {
  title: string;
  link: string;
  pubDate: string;
  source: string;
  sourceColor: string;
};

type LocalReport = {
  prefLabel: string;
  localNews: (NewsItem & { score: number })[];
  nearbyEvents: { id: string; title: string; severity: string; occurredAt: string; distKm: number }[];
};

// ─── カードコンポーネント ──────────────────────────
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: SM.card,
      border: `1px solid ${SM.border}`,
      borderRadius: 16,
      padding: '20px',
      boxShadow: SM.shadow,
      ...style,
    }}>
      {children}
    </div>
  );
}

function SectionLabel({ icon, label }: { icon: string; label: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      marginBottom: 14,
    }}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <span style={{
        fontSize: 16, fontWeight: 700, color: SM.text,
        letterSpacing: '0.02em',
      }}>{label}</span>
    </div>
  );
}

// ─── メイン: SimpleDashboard ──────────────────────
export function SimpleDashboard() {
  const events       = useDisasterStore((s) => s.events);
  const forecastDays = useDisasterStore((s) => s.forecastDays);
  const userLocation = useDisasterStore((s) => s.userLocation);
  const setSimpleMode = useDisasterStore((s) => s.setSimpleMode);

  const [localReport, setLocalReport] = useState<LocalReport | null>(null);
  const [newsItems,   setNewsItems]   = useState<NewsItem[]>([]);

  // 最大警戒レベルを計算
  const maxSeverity: 'none' | Severity = events.reduce(
    (max, ev) => SEVERITY_ORDER[ev.severity] > SEVERITY_ORDER[max] ? ev.severity : max,
    'none' as 'none' | Severity,
  );
  const alertDef = ALERT_DEFS[maxSeverity];

  // ローカルレポート取得
  useEffect(() => {
    if (!userLocation) return;
    fetch(`/api/local-report?lat=${userLocation.lat}&lng=${userLocation.lng}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d && setLocalReport(d))
      .catch(() => {});
  }, [userLocation]);

  // ニュース取得（ローカルがなければ全国版）
  useEffect(() => {
    fetch('/api/news')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d?.items && setNewsItems(d.items.slice(0, 5)))
      .catch(() => {});
  }, []);

  const today = forecastDays[0];

  return (
    <div style={{
      flex: 1,
      background: SM.bg,
      overflowY: 'auto',
      WebkitOverflowScrolling: 'touch',
      paddingBottom: 'max(24px, env(safe-area-inset-bottom, 24px))',
    }}>
      {/* モード切替バナー */}
      <div style={{
        background: '#1a2744',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>📋 簡易表示モード</div>
          <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11, marginTop: 2 }}>大きな文字で情報をお伝えします</div>
        </div>
        <button
          onClick={() => setSimpleMode(false)}
          style={{
            background: 'rgba(255,255,255,0.12)',
            border: '1.5px solid rgba(255,255,255,0.35)',
            borderRadius: 20,
            color: '#fff',
            fontSize: 12,
            fontWeight: 600,
            padding: '7px 14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
          }}
        >
          🔬 詳細モードへ
        </button>
      </div>

      <div style={{ padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* ── 警戒レベルカード ── */}
        <div style={{
          background: alertDef.bg,
          border: `3px solid ${alertDef.borderColor}`,
          borderRadius: 20,
          padding: '22px 20px',
          boxShadow: SM.shadow,
          animation: alertDef.pulse ? 'sm-pulse-border 1.2s ease-in-out infinite' : undefined,
        }}>
          {/* レベルバッジ */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <span style={{ fontSize: 36 }}>{alertDef.icon}</span>
            <div>
              <div style={{
                fontSize: 28, fontWeight: 900, color: alertDef.color,
                lineHeight: 1,
              }}>
                {alertDef.label}
              </div>
              <div style={{ fontSize: 14, color: alertDef.color, opacity: 0.8, marginTop: 2 }}>
                {alertDef.sublabel}
              </div>
            </div>
          </div>

          {/* 状況説明 */}
          <div style={{
            background: 'rgba(255,255,255,0.6)',
            borderRadius: 12,
            padding: '12px 14px',
            marginBottom: 14,
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: alertDef.color, marginBottom: 6, letterSpacing: '0.05em' }}>
              📌 現在の状況
            </div>
            <p style={{ fontSize: 17, color: SM.text, lineHeight: 1.6, margin: 0, fontWeight: 500 }}>
              {alertDef.meaning}
            </p>
          </div>

          {/* 行動指針 */}
          <div style={{
            background: 'rgba(255,255,255,0.6)',
            borderRadius: 12,
            padding: '12px 14px',
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: alertDef.color, marginBottom: 10, letterSpacing: '0.05em' }}>
              ✅ あなたがすべきこと
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {alertDef.action.map((a, i) => (
                <li key={i} style={{
                  fontSize: 15, color: SM.text, lineHeight: 1.55,
                  paddingLeft: 8,
                  borderLeft: `3px solid ${alertDef.borderColor}`,
                }}>
                  {a}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ── 関連するイベント（あれば） ── */}
        {events.length > 0 && (
          <Card>
            <SectionLabel icon="📡" label="最新の災害情報" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {events.slice(0, 4).map((ev) => {
                const sevColor = { emergency:'#dc2626', warning:'#ea580c', advisory:'#d97706', info:'#2563eb' }[ev.severity] ?? '#6b7280';
                return (
                  <div key={ev.id} style={{
                    display: 'flex', gap: 10, alignItems: 'flex-start',
                    padding: '10px 12px',
                    background: '#f8fafc',
                    borderRadius: 10,
                    borderLeft: `4px solid ${sevColor}`,
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: SM.text, lineHeight: 1.4 }}>
                        {ev.title}
                      </div>
                      <div style={{ fontSize: 12, color: SM.textMuted, marginTop: 4 }}>
                        {new Date(ev.occurredAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        {ev.area && ev.area.length > 0 && `　${ev.area.slice(0, 2).join('・')}`}
                      </div>
                    </div>
                    <span style={{
                      fontSize: 10, fontWeight: 700, color: '#fff',
                      background: sevColor,
                      padding: '3px 8px', borderRadius: 20,
                      whiteSpace: 'nowrap', alignSelf: 'flex-start',
                    }}>
                      {{ emergency:'緊急', warning:'警戒', advisory:'注意', info:'情報' }[ev.severity]}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* ── あなたの地域 ── */}
        {(userLocation || localReport) && (
          <Card>
            <SectionLabel icon="📍" label={`あなたの地域${localReport ? `（${localReport.prefLabel}）` : ''}`} />

            {!localReport && userLocation && (
              <p style={{ fontSize: 15, color: SM.textSub }}>地域情報を読み込んでいます…</p>
            )}

            {localReport && localReport.nearbyEvents.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#dc2626', marginBottom: 8 }}>
                  ⚠️ 周辺200km以内の地震
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {localReport.nearbyEvents.map((ev) => (
                    <div key={ev.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '10px 12px', background: '#fff5f5', borderRadius: 10,
                      border: '1px solid #fecaca',
                    }}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: SM.text }}>{ev.title}</div>
                        <div style={{ fontSize: 12, color: SM.textMuted, marginTop: 2 }}>
                          {new Date(ev.occurredAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <div style={{
                        fontSize: 16, fontWeight: 700, color: '#dc2626',
                        background: '#fee2e2', padding: '4px 10px', borderRadius: 20,
                        whiteSpace: 'nowrap',
                      }}>
                        約{Math.round(ev.distKm)}km
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {localReport && localReport.nearbyEvents.length === 0 && (
              <div style={{
                padding: '12px 14px', background: '#f0fdf4', borderRadius: 10,
                border: '1px solid #86efac', marginBottom: localReport.localNews.length > 0 ? 14 : 0,
              }}>
                <div style={{ fontSize: 15, color: '#166534', fontWeight: 600 }}>
                  ✅ 周辺200km以内に最近の地震はありません
                </div>
              </div>
            )}

            {!userLocation && (
              <div style={{
                padding: '12px 14px', background: '#eff6ff', borderRadius: 10,
                border: '1px solid #93c5fd',
              }}>
                <div style={{ fontSize: 14, color: '#1d4ed8' }}>
                  📍 現在地を許可すると、あなたの地域の情報が表示されます
                </div>
              </div>
            )}
          </Card>
        )}

        {/* ── 今日の天気 ── */}
        {today && (
          <Card>
            <SectionLabel icon="🌤" label="今日の天気" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <span style={{ fontSize: 52 }}>{weatherEmoji(today.weatherCode)}</span>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700, color: SM.text, lineHeight: 1.3 }}>
                  {today.weather}
                </div>
                <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                  {today.popMax !== undefined && (
                    <div>
                      <span style={{ fontSize: 12, color: SM.textMuted }}>☔ 降水確率</span>
                      <div style={{ fontSize: 20, fontWeight: 700, color: '#2563eb' }}>{today.popMax}%</div>
                    </div>
                  )}
                  {today.tempMax !== undefined && (
                    <div>
                      <span style={{ fontSize: 12, color: SM.textMuted }}>🌡️ 最高気温</span>
                      <div style={{ fontSize: 20, fontWeight: 700, color: '#dc2626' }}>{today.tempMax}°C</div>
                    </div>
                  )}
                  {today.tempMin !== undefined && (
                    <div>
                      <span style={{ fontSize: 12, color: SM.textMuted }}>❄ 最低気温</span>
                      <div style={{ fontSize: 20, fontWeight: 700, color: '#2563eb' }}>{today.tempMin}°C</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* ── 今週の天気 ── */}
        {forecastDays.length > 1 && (
          <Card>
            <SectionLabel icon="📅" label="今週の天気" />
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
              {forecastDays.slice(0, 7).map((d) => {
                const date = new Date(d.date);
                const weekday = ['日','月','火','水','木','金','土'][date.getDay()];
                const isToday = d.date === today?.date;
                return (
                  <div key={d.date} style={{
                    flexShrink: 0, minWidth: 58,
                    background: isToday ? '#eff6ff' : '#f8fafc',
                    border: `1px solid ${isToday ? '#93c5fd' : SM.border}`,
                    borderRadius: 12, padding: '10px 6px',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: weekday === '日' ? '#dc2626' : weekday === '土' ? '#2563eb' : SM.textSub }}>
                      {isToday ? '今日' : weekday}
                    </div>
                    <div style={{ fontSize: 22 }}>{weatherEmoji(d.weatherCode)}</div>
                    <div style={{ fontSize: 11, color: '#2563eb', fontWeight: 600 }}>{d.popMax}%</div>
                    {d.tempMax !== undefined && (
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#dc2626' }}>{d.tempMax}°</div>
                    )}
                    {d.tempMin !== undefined && (
                      <div style={{ fontSize: 12, color: '#6b7280' }}>{d.tempMin}°</div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* ── 地域のニュース ── */}
        {(localReport?.localNews.length || newsItems.length) > 0 && (
          <Card>
            <SectionLabel icon="📰" label="地域のニュース" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {(localReport?.localNews.length ? localReport.localNews : newsItems).map((item, i) => (
                <a
                  key={i}
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'block',
                    padding: '14px 4px',
                    textDecoration: 'none',
                    borderBottom: i < 4 ? `1px solid ${SM.border}` : 'none',
                  }}
                >
                  <div style={{ fontSize: 15, color: '#1d4ed8', lineHeight: 1.5, fontWeight: 500, marginBottom: 6 }}>
                    {item.title}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{
                      fontSize: 11, color: item.sourceColor ?? SM.textMuted,
                      border: `1px solid ${item.sourceColor ?? SM.border}`,
                      padding: '1px 6px', borderRadius: 4,
                    }}>
                      {item.source}
                    </span>
                    <span style={{ fontSize: 12, color: SM.textMuted }}>
                      {item.pubDate ? new Date(item.pubDate).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>
                </a>
              ))}
            </div>
          </Card>
        )}

        {/* ── 地図ボタン（詳細モードへ） ── */}
        <button
          onClick={() => setSimpleMode(false)}
          style={{
            width: '100%',
            padding: '16px',
            background: '#1a2744',
            border: 'none',
            borderRadius: 14,
            color: '#fff',
            fontSize: 17,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            boxShadow: SM.shadow,
          }}
        >
          🗾 地図で現在の状況を確認する（詳細モード）
        </button>

        {/* フッター */}
        <div style={{
          textAlign: 'center',
          padding: '8px 0',
          color: SM.textMuted,
          fontSize: 12,
          lineHeight: 1.7,
        }}>
          情報提供: 気象庁・P2P地震情報<br />
          ⚠️ 本情報は参考です。公式発表・自治体の指示を最優先にしてください。
        </div>

      </div>

      {/* パルスアニメーション */}
      <style>{`
        @keyframes sm-pulse-border {
          0%, 100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.4); }
          50%       { box-shadow: 0 0 0 10px rgba(220, 38, 38, 0); }
        }
      `}</style>
    </div>
  );
}
