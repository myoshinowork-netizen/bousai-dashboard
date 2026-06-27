'use client';

import { useState, useEffect, useRef } from 'react';
import { useDisasterStore } from '@/store/useDisasterStore';
import type { EewData } from '@/lib/model';

const P_KMS = 6.0;
const S_KMS = 3.5;

// ────────────────────────────────────────────────
// ユーティリティ
// ────────────────────────────────────────────────
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function scaleLabel(maxScale: number): string {
  const map: Record<number, string> = {
    10: '1', 20: '2', 30: '3', 40: '4', 45: '4強',
    50: '5弱', 55: '5強', 60: '6弱', 65: '6強', 70: '7',
  };
  return map[maxScale] ?? `${maxScale / 10}`;
}

// ────────────────────────────────────────────────
// 秒カウントダウン
// ────────────────────────────────────────────────
function useCountdown(targetMs: number | null) {
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    if (targetMs === null) { setRemaining(null); return; }
    const tick = () => setRemaining(Math.max(0, Math.round((targetMs - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [targetMs]);
  return remaining;
}

// ────────────────────────────────────────────────
// メインコンポーネント
// ────────────────────────────────────────────────
export function EewModal() {
  const eew          = useDisasterStore((s) => s.eewAlert);
  const setEewAlert  = useDisasterStore((s) => s.setEewAlert);
  const userLocation = useDisasterStore((s) => s.userLocation);

  const [dismissed, setDismissed] = useState(false);
  const prevIdRef   = useRef<string | null>(null);

  // 新しい EEW が来たら dismissed をリセット
  useEffect(() => {
    if (!eew) return;
    const key = `${eew.id}-${eew.serial}`;
    if (key !== prevIdRef.current) {
      prevIdRef.current = key;
      setDismissed(false);
    }
  }, [eew]);

  // EEW がなくなってから 5 分後に自動クリア
  useEffect(() => {
    if (!eew?.isFinal) return;
    const id = setTimeout(() => setEewAlert(null), 5 * 60 * 1000);
    return () => clearTimeout(id);
  }, [eew?.isFinal, setEewAlert]);

  if (!eew || dismissed) return null;

  // 距離・到達時刻計算
  const quakeMs  = new Date(eew.quakeTime).getTime();
  let distKm: number | null = null;
  let pArrivalMs: number | null = null;
  let sArrivalMs: number | null = null;

  if (userLocation) {
    distKm     = haversineKm(userLocation.lat, userLocation.lng, eew.lat, eew.lng);
    pArrivalMs = quakeMs + (distKm / P_KMS) * 1000;
    sArrivalMs = quakeMs + (distKm / S_KMS) * 1000;
  }

  const sCountdown = useCountdown(sArrivalMs);
  const pCountdown = useCountdown(pArrivalMs);

  const isWarning  = eew.isWarning;
  const accent     = isWarning ? '#ff1744' : '#ff6d00';
  const bgColor    = isWarning ? 'rgba(255,23,68,0.12)' : 'rgba(255,109,0,0.10)';

  // S波カウントダウン色
  const sColor = sCountdown !== null
    ? (sCountdown <= 5  ? '#ff1744'
     : sCountdown <= 15 ? '#ff6d00'
     : sCountdown <= 30 ? '#ffd600'
     : '#00e5ff')
    : '#00e5ff';

  return (
    <div
      style={{
        position: 'fixed',
        top: 52,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1100,
        width: 'min(480px, 96vw)',
        background: 'rgba(4,5,14,0.97)',
        border: `2px solid ${accent}`,
        boxShadow: `0 0 40px ${accent}55, 0 0 0 1px ${accent}33`,
        fontFamily: 'var(--font-geist-mono, monospace)',
        animation: 'cp-pulse-border 1s ease-in-out infinite',
      }}
    >
      {/* コーナー装飾 */}
      {[
        { top: 0, left: 0, borderTop: `2px solid ${accent}`, borderLeft: `2px solid ${accent}` },
        { top: 0, right: 0, borderTop: `2px solid ${accent}`, borderRight: `2px solid ${accent}` },
        { bottom: 0, left: 0, borderBottom: `2px solid ${accent}`, borderLeft: `2px solid ${accent}` },
        { bottom: 0, right: 0, borderBottom: `2px solid ${accent}`, borderRight: `2px solid ${accent}` },
      ].map((s, i) => (
        <div key={i} style={{ position: 'absolute', width: 10, height: 10, ...s, zIndex: 2 }} />
      ))}

      {/* ヘッダー */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 12px',
        background: bgColor,
        borderBottom: `1px solid ${accent}44`,
      }}>
        <span style={{
          color: accent, fontSize: 8, letterSpacing: '0.2em',
          animation: 'cp-pulse-opacity 0.8s ease-in-out infinite',
        }}>
          ◆◆
        </span>
        <span style={{ color: accent, fontSize: 9, letterSpacing: '0.22em', fontWeight: 700 }}>
          {isWarning ? '緊急地震速報（警報）' : '緊急地震速報（予報）'}
        </span>
        {!eew.isFinal && (
          <span style={{
            marginLeft: 4, background: `${accent}22`, border: `1px solid ${accent}66`,
            color: accent, fontSize: 6, padding: '1px 5px', letterSpacing: '0.15em',
          }}>
            第{eew.serial}報
          </span>
        )}
        {eew.isFinal && (
          <span style={{
            marginLeft: 4, background: 'rgba(120,144,156,0.15)', border: '1px solid rgba(120,144,156,0.4)',
            color: '#78909c', fontSize: 6, padding: '1px 5px', letterSpacing: '0.15em',
          }}>
            最終報
          </span>
        )}
        <button
          onClick={() => setDismissed(true)}
          style={{
            marginLeft: 'auto', color: 'var(--cp-muted)',
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
            fontSize: 10, cursor: 'pointer', padding: '2px 8px',
          }}
        >
          ✕
        </button>
      </div>

      {/* 本文 */}
      <div style={{ padding: '10px 14px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>

        {/* 左: 震源情報 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: accent, fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', lineHeight: 1.2 }}>
            {eew.epicenterName}
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 5, flexWrap: 'wrap' }}>
            <div>
              <span style={{ color: 'var(--cp-muted)', fontSize: 7, letterSpacing: '0.1em' }}>M </span>
              <span style={{ color: 'var(--cp-text)', fontSize: 16, fontWeight: 700 }}>{eew.magnitude.toFixed(1)}</span>
            </div>
            {eew.maxScale > 0 && (
              <div>
                <span style={{ color: 'var(--cp-muted)', fontSize: 7, letterSpacing: '0.1em' }}>最大震度 </span>
                <span style={{ color: accent, fontSize: 16, fontWeight: 700 }}>{scaleLabel(eew.maxScale)}</span>
              </div>
            )}
            {eew.depth > 0 && (
              <div>
                <span style={{ color: 'var(--cp-muted)', fontSize: 7 }}>深さ </span>
                <span style={{ color: 'var(--cp-text)', fontSize: 11 }}>{eew.depth}km</span>
              </div>
            )}
          </div>
          <div style={{ color: 'var(--cp-muted)', fontSize: 7, marginTop: 6, letterSpacing: '0.08em' }}>
            推定発生: {new Date(eew.quakeTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
        </div>

        {/* 右: 到達カウントダウン */}
        {distKm !== null && sArrivalMs !== null && (
          <div style={{
            flexShrink: 0, textAlign: 'center',
            background: 'rgba(0,0,0,0.3)', border: `1px solid ${sColor}44`,
            padding: '8px 14px', minWidth: 110,
          }}>
            <div style={{ color: 'var(--cp-muted)', fontSize: 6, letterSpacing: '0.15em', marginBottom: 2 }}>
              現在地まで
            </div>

            {/* S波カウントダウン */}
            <div style={{ marginBottom: 6 }}>
              <div style={{ color: 'var(--cp-muted)', fontSize: 6, letterSpacing: '0.1em' }}>S波（主要動）</div>
              {(sCountdown ?? 0) <= 0 ? (
                <div style={{ color: '#ff1744', fontSize: 18, fontWeight: 700, animation: 'cp-pulse-opacity 0.5s ease-in-out infinite' }}>
                  到達中
                </div>
              ) : (
                <div style={{ color: sColor, fontSize: 22, fontWeight: 700, lineHeight: 1, transition: 'color 0.3s' }}>
                  {sCountdown}<span style={{ fontSize: 9, marginLeft: 2 }}>秒</span>
                </div>
              )}
            </div>

            {/* P波カウントダウン */}
            {pCountdown !== null && pCountdown > 0 && (
              <div>
                <div style={{ color: 'var(--cp-muted)', fontSize: 6, letterSpacing: '0.1em' }}>P波（初期微動）</div>
                <div style={{ color: '#00e5ff', fontSize: 13, fontWeight: 600 }}>
                  {pCountdown}<span style={{ fontSize: 7, marginLeft: 1 }}>秒</span>
                </div>
              </div>
            )}

            {/* 距離 */}
            <div style={{ color: 'var(--cp-muted)', fontSize: 6, marginTop: 6, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 4 }}>
              震源距離 {Math.round(distKm)}km
            </div>
          </div>
        )}

        {/* 位置情報なしの場合 */}
        {!userLocation && (
          <div style={{
            flexShrink: 0, textAlign: 'center',
            background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
            padding: '8px 10px', fontSize: 7, color: 'var(--cp-muted)',
            letterSpacing: '0.08em', lineHeight: 1.6, maxWidth: 110,
          }}>
            ◎ ボタンで<br/>現在地を設定すると<br/>到達予測を表示
          </div>
        )}
      </div>

      {/* フッター注釈 */}
      <div style={{
        padding: '4px 14px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        color: 'var(--cp-muted)', fontSize: 6, letterSpacing: '0.06em',
      }}>
        情報源: P2P地震情報 ／ 本情報は参考値です。身の安全を最優先にしてください。
      </div>
    </div>
  );
}
