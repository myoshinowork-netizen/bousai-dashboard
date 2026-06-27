'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect, useRef } from 'react';
import { EventFeed }        from '@/components/EventFeed/EventFeed';
import { AlertBanner }      from '@/components/AlertBanner/AlertBanner';
import { LayerControl }     from '@/components/LayerControl/LayerControl';
import { TimelineControl }  from '@/components/Timeline/TimelineControl';
import { WeeklyForecast }   from '@/components/Forecast/WeeklyForecast';
import { MapOverlays }      from '@/components/MapOverlays/MapOverlays';
import { useQuakePoller }   from '@/lib/useQuakePoller';
import { useWeatherPoller } from '@/lib/useWeatherPoller';
import { useEewListener }   from '@/lib/useEewListener';
import { EewModal }         from '@/components/EewModal/EewModal';
import { useDisasterStore } from '@/store/useDisasterStore';
import { useIsMobile }      from '@/lib/useIsMobile';

const DisasterMap = dynamic(
  () => import('@/components/Map/DisasterMap').then((m) => m.DisasterMap),
  { ssr: false, loading: () => <div className="w-full h-full" style={{ background: 'var(--cp-bg)' }} /> }
);

// ────────────────────────────────────────────────
// ライブ時計
// ────────────────────────────────────────────────
function LiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span style={{ fontFamily: 'var(--font-orbitron)', color: 'var(--cp-red)', fontSize: 13, letterSpacing: '0.1em' }}>
      {time.toLocaleTimeString('ja-JP')}
    </span>
  );
}

function Clock() {
  const events = useDisasterStore((s) => s.events);
  const latest = events[0];
  return (
    <div className="flex flex-col items-end">
      <LiveClock />
      {latest && (
        <span className="cp-label" style={{ fontSize: 9 }}>
          LAST: {new Date(latest.occurredAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
      )}
    </div>
  );
}

function StatusBadge({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-1">
      <span
        style={{ background: ok ? 'var(--cp-cyan)' : 'var(--cp-red)', width: 5, height: 5 }}
        className={`rounded-full ${ok ? '' : 'cp-pulse'}`}
      />
      <span className="cp-label" style={{ fontSize: 9 }}>{label}</span>
    </div>
  );
}

// ────────────────────────────────────────────────
// モバイル ハンバーガーメニュー
// ────────────────────────────────────────────────
type MobilePanel = 'events' | 'layers' | 'forecast' | null;

const MENU_ITEMS: { id: MobilePanel; icon: string; label: string; labelEn: string }[] = [
  { id: 'events',   icon: '◈', label: 'イベント',  labelEn: 'EVENT FEED'    },
  { id: 'layers',   icon: '◇', label: 'レイヤー',  labelEn: 'LAYER CONTROL' },
  { id: 'forecast', icon: '☁', label: '天気予報',  labelEn: 'WEATHER FCST'  },
];

function HamburgerIcon({ open }: { open: boolean }) {
  const bar = (y: number, w = '100%') => (
    <div style={{
      position: 'absolute', left: 0, top: y,
      width: w, height: 2,
      background: open ? 'var(--cp-cyan)' : 'var(--cp-text)',
      transition: 'all 0.2s ease',
      transformOrigin: 'center',
      ...(open && y === 4  ? { transform: 'rotate(45deg) translate(4px, 4px)' } : {}),
      ...(open && y === 10 ? { opacity: 0, transform: 'scaleX(0)' } : {}),
      ...(open && y === 16 ? { transform: 'rotate(-45deg) translate(4px, -4px)' } : {}),
    }} />
  );
  return (
    <div style={{ position: 'relative', width: 22, height: 22 }}>
      {bar(4)}
      {bar(10, open ? '70%' : '100%')}
      {bar(16)}
    </div>
  );
}

function MobileHamburgerMenu({
  open, activePanel, onSelect, onClose,
}: {
  open: boolean;
  activePanel: MobilePanel;
  onSelect: (p: MobilePanel) => void;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <>
      {/* 背景オーバーレイ（タップで閉じる）*/}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 900,
          background: 'rgba(0,0,0,0.4)',
        }}
      />
      {/* メニューパネル */}
      <div
        style={{
          position: 'fixed',
          top: 44,   // ヘッダー高さ分
          right: 0,
          zIndex: 901,
          width: 220,
          background: 'rgba(6,8,18,0.97)',
          border: '1px solid var(--cp-border)',
          borderTop: 'none',
          borderRight: 'none',
          boxShadow: '-4px 4px 24px rgba(255,23,68,0.15)',
        }}
      >
        {/* メニューヘッダー */}
        <div style={{
          padding: '8px 14px',
          borderBottom: '1px solid var(--cp-border)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <span style={{ color: 'var(--cp-cyan)', fontSize: 7, letterSpacing: '0.25em' }}>◆◆</span>
          <span style={{ color: 'var(--cp-muted)', fontSize: 8, letterSpacing: '0.2em' }}>SYSTEM MENU</span>
        </div>

        {MENU_ITEMS.map((item, i) => {
          const isActive = activePanel === item.id;
          return (
            <button
              key={item.id}
              onClick={() => { onSelect(isActive ? null : item.id); onClose(); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                width: '100%',
                padding: '14px 16px',
                gap: 12,
                background: isActive ? 'rgba(0,229,255,0.07)' : 'transparent',
                borderBottom: i < MENU_ITEMS.length - 1 ? '1px solid rgba(255,23,68,0.12)' : 'none',
                borderLeft: isActive ? '2px solid var(--cp-cyan)' : '2px solid transparent',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background 0.15s',
              }}
            >
              <span style={{ fontSize: 18, color: isActive ? 'var(--cp-cyan)' : 'var(--cp-muted)', width: 24, textAlign: 'center' }}>
                {item.icon}
              </span>
              <div>
                <div style={{ color: isActive ? 'var(--cp-cyan)' : 'var(--cp-text)', fontSize: 13, letterSpacing: '0.05em' }}>
                  {item.label}
                </div>
                <div style={{ color: 'var(--cp-muted)', fontSize: 8, letterSpacing: '0.15em', marginTop: 2 }}>
                  {item.labelEn}
                </div>
              </div>
              {isActive && (
                <span style={{ marginLeft: 'auto', color: 'var(--cp-cyan)', fontSize: 8, letterSpacing: '0.1em' }}>
                  ▶ ACTIVE
                </span>
              )}
            </button>
          );
        })}

        {/* 区切り + 閉じるボタン */}
        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--cp-border)' }}>
          <button
            onClick={onClose}
            style={{
              width: '100%',
              padding: '8px',
              background: 'rgba(255,23,68,0.06)',
              border: '1px solid rgba(255,23,68,0.25)',
              color: 'var(--cp-muted)',
              fontSize: 9,
              letterSpacing: '0.15em',
              cursor: 'pointer',
            }}
          >
            ✕ CLOSE MENU
          </button>
        </div>
      </div>
    </>
  );
}

// ────────────────────────────────────────────────
// メインページ
// ────────────────────────────────────────────────
export default function DashboardPage() {
  useQuakePoller();
  useWeatherPoller();
  useEewListener();

  const isMobile   = useIsMobile();
  const [menuOpen,     setMenuOpen]     = useState(false);
  const [mobilePanel,  setMobilePanel]  = useState<MobilePanel>(null);

  // メニューを閉じたとき mobilePanel=null なら地図全画面
  function handleMenuSelect(p: MobilePanel) {
    setMobilePanel(p);
  }

  return (
    <div style={{ background: 'var(--cp-bg)', height: '100svh' }} className="flex flex-col">
      <AlertBanner />
      <EewModal />

      {/* ヘッダー */}
      <header
        style={{ borderBottom: '1px solid var(--cp-border)', background: 'var(--cp-panel)', minHeight: 44 }}
        className="flex items-center px-3 py-2 shrink-0 gap-3"
      >
        {/* タイトル（左） */}
        <div className="flex items-center gap-2 shrink-0">
          <span style={{ color: 'var(--cp-red)', fontSize: 16 }}>◆</span>
          <h1 style={{
            fontFamily: 'var(--font-orbitron)',
            color: 'var(--cp-text)',
            fontSize: isMobile ? 9 : 10,
            letterSpacing: '0.12em',
            whiteSpace: 'nowrap',
          }}>
            {isMobile ? 'CRISIS GOV.' : 'CRISIS GOVERNANCE PROTOCOL'}
          </h1>
        </div>

        {/* デスクトップ: ステータスバッジ */}
        {!isMobile && (
          <div className="flex items-center gap-3 ml-2">
            <StatusBadge label="P2P-API"   ok />
            <StatusBadge label="GSI-TILES" ok />
            <StatusBadge label="JMA-NOWC"  ok />
          </div>
        )}

        {/* デスクトップ: 注意書き */}
        {!isMobile && (
          <span className="ml-auto cp-label" style={{ fontSize: 9 }}>
            本アプリの情報は参考値です。公式発表・自治体指示を最優先にしてください。
          </span>
        )}

        {/* 時計（右寄せ） */}
        <div className={isMobile ? 'ml-auto' : ''}>
          <Clock />
        </div>

        {/* モバイル: ハンバーガーボタン */}
        {isMobile && (
          <button
            onClick={() => setMenuOpen((v) => !v)}
            style={{
              marginLeft: 8,
              padding: '6px 8px',
              background: menuOpen ? 'rgba(0,229,255,0.1)' : 'transparent',
              border: `1px solid ${menuOpen ? 'var(--cp-cyan)' : 'var(--cp-border)'}`,
              color: menuOpen ? 'var(--cp-cyan)' : 'var(--cp-text)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 36,
              minHeight: 32,
              flexShrink: 0,
            }}
          >
            <HamburgerIcon open={menuOpen} />
          </button>
        )}
      </header>

      {/* モバイル: ハンバーガーメニュードロップダウン */}
      {isMobile && (
        <MobileHamburgerMenu
          open={menuOpen}
          activePanel={mobilePanel}
          onSelect={handleMenuSelect}
          onClose={() => setMenuOpen(false)}
        />
      )}

      {/* メインレイアウト */}
      <div className="flex flex-1 overflow-hidden">

        {/* 地図エリア */}
        <main className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 relative overflow-hidden">
            <DisasterMap />
            <MapOverlays isMobile={isMobile} />
          </div>
          <TimelineControl isMobile={isMobile} />
        </main>

        {/* デスクトップ: サイドパネル */}
        {!isMobile && (
          <aside
            style={{ borderLeft: '1px solid var(--cp-border)', background: 'var(--cp-panel)', width: 280 }}
            className="flex flex-col overflow-hidden shrink-0"
          >
            {/* 上部: レイヤー制御 + 天気予報 (60%) */}
            <div className="flex flex-col overflow-hidden" style={{ flex: 3, borderBottom: '2px solid var(--cp-border)' }}>
              <div
                className="shrink-0 p-2 overflow-y-auto"
                style={{ borderBottom: '1px solid var(--cp-border)', maxHeight: '55%' }}
              >
                <LayerControl />
              </div>
              <div className="flex-1 overflow-hidden">
                <WeeklyForecast />
              </div>
            </div>

            {/* 下部: イベントフィード (40%) */}
            <div className="flex flex-col overflow-hidden" style={{ flex: 2 }}>
              <EventFeed />
            </div>
          </aside>
        )}
      </div>

      {/* モバイル: フローティングパネル（メニュー選択時） */}
      {isMobile && mobilePanel !== null && (
        <>
          {/* 背景タップで閉じる（半透明） */}
          <div
            onClick={() => setMobilePanel(null)}
            style={{
              position: 'fixed', inset: 0, zIndex: 800,
              background: 'rgba(0,0,0,0.35)',
            }}
          />
          {/* フローティングウィンドウ */}
          <div
            style={{
              position: 'fixed',
              bottom: 80,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 801,
              width: 'min(340px, 92vw)',
              height: '52vh',
              background: 'rgba(6,8,18,0.97)',
              border: '1px solid var(--cp-cyan)',
              boxShadow: '0 0 32px rgba(0,229,255,0.18), 0 0 0 1px rgba(0,229,255,0.08)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* コーナー装飾 */}
            {[
              { top: 0, left: 0, borderTop: '2px solid var(--cp-cyan)', borderLeft: '2px solid var(--cp-cyan)', width: 12, height: 12 },
              { top: 0, right: 0, borderTop: '2px solid var(--cp-cyan)', borderRight: '2px solid var(--cp-cyan)', width: 12, height: 12 },
              { bottom: 0, left: 0, borderBottom: '2px solid var(--cp-cyan)', borderLeft: '2px solid var(--cp-cyan)', width: 12, height: 12 },
              { bottom: 0, right: 0, borderBottom: '2px solid var(--cp-cyan)', borderRight: '2px solid var(--cp-cyan)', width: 12, height: 12 },
            ].map((s, i) => (
              <div key={i} style={{ position: 'absolute', ...s, zIndex: 2, pointerEvents: 'none' }} />
            ))}

            {/* ウィンドウヘッダー */}
            <div style={{
              display: 'flex', alignItems: 'center',
              padding: '7px 12px',
              borderBottom: '1px solid var(--cp-border)',
              background: 'rgba(0,229,255,0.06)',
              flexShrink: 0, gap: 8,
            }}>
              <span style={{ color: 'var(--cp-cyan)', fontSize: 7, opacity: 0.7 }}>◈</span>
              <span style={{ color: 'var(--cp-cyan)', fontSize: 9, letterSpacing: '0.2em' }}>
                {MENU_ITEMS.find((m) => m.id === mobilePanel)?.labelEn}
              </span>
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: 'var(--cp-muted)', fontSize: 7, letterSpacing: '0.1em' }}>
                  {MENU_ITEMS.find((m) => m.id === mobilePanel)?.label}
                </span>
                <button
                  onClick={() => setMobilePanel(null)}
                  style={{
                    color: 'var(--cp-muted)', background: 'rgba(255,23,68,0.08)',
                    border: '1px solid rgba(255,23,68,0.3)',
                    fontSize: 10, cursor: 'pointer', lineHeight: 1,
                    padding: '3px 7px', letterSpacing: '0.1em',
                  }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* コンテンツ */}
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              {mobilePanel === 'events'   && <EventFeed />}
              {mobilePanel === 'layers'   && (
                <div className="p-3 overflow-y-auto h-full">
                  <LayerControl />
                </div>
              )}
              {mobilePanel === 'forecast' && <WeeklyForecast />}
            </div>
          </div>
        </>
      )}

      {/* デスクトップ: フッター */}
      {!isMobile && (
        <footer
          style={{ borderTop: '1px solid var(--cp-border)', background: 'var(--cp-panel)' }}
          className="flex items-center justify-between px-4 py-1 shrink-0"
        >
          <span className="cp-label" style={{ fontSize: 9 }}>
            DATA: P2P地震情報 / 気象庁防災情報 / 国土地理院
          </span>
          <span className="cp-label" style={{ fontSize: 9 }}>
            MAP: 国土地理院 / © OpenStreetMap contributors
          </span>
        </footer>
      )}
    </div>
  );
}
