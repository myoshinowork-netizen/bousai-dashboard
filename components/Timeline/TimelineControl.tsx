'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useDisasterStore } from '@/store/useDisasterStore';

// タイムライン範囲: 前後24時間（分単位）
const RANGE_MINUTES = 24 * 60;
const STEP_MINUTES  = 30;

function minutesToTime(minutes: number): Date {
  return new Date(Date.now() + minutes * 60 * 1000);
}

function formatSliderTime(minutes: number): string {
  const d = minutesToTime(minutes);
  return d.toLocaleString('ja-JP', {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatMode(minutes: number): string {
  if (minutes === 0) return 'LIVE';
  if (minutes < 0)   return `HIST -${Math.abs(Math.round(minutes / 60))}h`;
  return `FCST +${Math.round(minutes / 60)}h`;
}

// タイムラインのラベル（-24h, -12h, NOW, +12h, +24h）
const LABELS = [-24, -12, 0, 12, 24];

export function TimelineControl({ isMobile = false }: { isMobile?: boolean }) {
  const selectedTime   = useDisasterStore((s) => s.selectedTime);
  const setSelectedTime = useDisasterStore((s) => s.setSelectedTime);

  // スライダー値（分）: null → 0
  const [sliderMin, setSliderMin] = useState(0);
  const isLive = selectedTime === null;
  const nowRef = useRef(Date.now());

  // ライブモード中は現在時刻に追従
  useEffect(() => {
    if (!isLive) return;
    const id = setInterval(() => { nowRef.current = Date.now(); }, 30000);
    return () => clearInterval(id);
  }, [isLive]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseInt(e.target.value, 10);
    setSliderMin(v);
    if (v === 0) {
      setSelectedTime(null); // ライブモード
    } else {
      setSelectedTime(Date.now() + v * 60 * 1000);
    }
  }, [setSelectedTime]);

  const resetToLive = useCallback(() => {
    setSliderMin(0);
    setSelectedTime(null);
  }, [setSelectedTime]);

  const pct = ((sliderMin + RANGE_MINUTES) / (RANGE_MINUTES * 2)) * 100;

  return (
    <div
      style={{ borderTop: '1px solid var(--cp-border)', background: 'var(--cp-panel)' }}
      className={`shrink-0 ${isMobile ? 'px-3 py-2' : 'px-4 py-2'}`}
    >
      {/* ヘッダー行 */}
      <div className={`flex items-center gap-3 ${isMobile ? 'mb-1' : 'mb-1.5'}`}>
        <span className="cp-label text-[9px] tracking-widest">TIMELINE</span>

        {/* モードバッジ */}
        <span
          style={{
            color: isLive ? 'var(--cp-cyan)' : sliderMin < 0 ? 'var(--cp-yellow)' : 'var(--cp-orange)',
            fontSize: 9,
            letterSpacing: '0.15em',
            border: `1px solid ${isLive ? 'var(--cp-cyan)' : sliderMin < 0 ? 'var(--cp-yellow)' : 'var(--cp-orange)'}`,
            padding: '1px 6px',
          }}
        >
          {formatMode(sliderMin)}
        </span>

        <span
          style={{ color: isLive ? 'var(--cp-cyan)' : 'var(--cp-text)', fontSize: 11, fontFamily: 'var(--font-orbitron)' }}
          className="ml-2"
        >
          {isLive ? '── LIVE ──' : formatSliderTime(sliderMin)}
        </span>

        {!isLive && (
          <button
            onClick={resetToLive}
            style={{ color: 'var(--cp-cyan)', fontSize: 9, border: '1px solid var(--cp-cyan)', padding: '1px 8px', letterSpacing: '0.12em' }}
            className="ml-auto uppercase"
          >
            NOW
          </button>
        )}
      </div>

      {/* スライダー本体 */}
      <div className="relative">
        {/* ラベル（モバイルは -24h, NOW, +24h のみ） */}
        <div className="flex justify-between mb-1">
          {(isMobile ? [-24, 0, 24] : LABELS).map((h) => (
            <span key={h} className="cp-label" style={{ fontSize: isMobile ? 10 : 8 }}>
              {h === 0 ? 'NOW' : `${h > 0 ? '+' : ''}${h}h`}
            </span>
          ))}
        </div>

        {/* プログレスバー背景 */}
        <div
          style={{ background: 'var(--cp-panel2)', border: '1px solid var(--cp-border)', height: 4, borderRadius: 2, position: 'relative' }}
          className="mb-1"
        >
          {/* 過去側（黄） */}
          <div style={{
            position: 'absolute', left: 0, top: 0, height: '100%',
            width: `${pct}%`,
            background: sliderMin < 0 ? 'rgba(255,214,0,0.4)' : sliderMin > 0 ? 'rgba(255,109,0,0.4)' : 'rgba(0,229,255,0.4)',
            borderRadius: 2,
          }} />
          {/* NOW マーカー */}
          <div style={{
            position: 'absolute', left: '50%', top: -3, width: 2, height: 10,
            background: 'var(--cp-cyan)', transform: 'translateX(-50%)',
          }} />
        </div>

        {/* スライダー input */}
        <input
          type="range"
          min={-RANGE_MINUTES}
          max={RANGE_MINUTES}
          step={STEP_MINUTES}
          value={sliderMin}
          onChange={handleChange}
          style={{ width: '100%', accentColor: 'var(--cp-cyan)', cursor: 'pointer', height: 4 }}
          className="absolute top-4 left-0 opacity-0 w-full"
        />
        {/* カスタムつまみ */}
        <div
          style={{
            position: 'absolute',
            left: `calc(${pct}% - 6px)`,
            top: 2,
            width: 12, height: 12,
            background: 'var(--cp-bg)',
            border: `2px solid ${isLive ? 'var(--cp-cyan)' : sliderMin < 0 ? 'var(--cp-yellow)' : 'var(--cp-orange)'}`,
            borderRadius: 2,
            pointerEvents: 'none',
          }}
        />
        {/* 透明スライダー（操作用）*/}
        <input
          type="range"
          min={-RANGE_MINUTES}
          max={RANGE_MINUTES}
          step={STEP_MINUTES}
          value={sliderMin}
          onChange={handleChange}
          style={{ width: '100%', cursor: 'pointer', opacity: 0, position: 'absolute', top: 0, left: 0, height: 20 }}
        />
      </div>
    </div>
  );
}
