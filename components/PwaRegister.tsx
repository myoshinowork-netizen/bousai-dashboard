'use client';

import { useEffect, useState } from 'react';

export function PwaRegister() {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // 開発中は既存SWをアンレジスターしてHMR競合を防ぐ
    if (process.env.NODE_ENV !== 'production') {
      navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
      return;
    }

    let unmounted = false;
    let updateIntervalId: ReturnType<typeof setInterval> | null = null;

    const notify = () => { if (!unmounted) setShowBanner(true); };

    // インストール中 SW の statechange を監視してバナー表示
    function watchInstalling(sw: ServiceWorker) {
      // skipWaiting() により installed → activating に高速遷移するため両方チェック
      if (sw.state === 'installed' || sw.state === 'activating' || sw.state === 'activated') {
        notify();
        return;
      }
      const onStateChange = () => {
        if (sw.state === 'installed' || sw.state === 'activating') {
          notify();
          sw.removeEventListener('statechange', onStateChange);
        }
      };
      sw.addEventListener('statechange', onStateChange);
    }

    navigator.serviceWorker.register('/sw.js').then((reg) => {
      if (unmounted) return;

      // ページロード時点で既に waiting / installing の SW がある場合
      if (reg.waiting)    { notify(); return; }
      if (reg.installing) { watchInstalling(reg.installing); }

      // 新しい SW が見つかったとき（デプロイ後の初回検知）
      reg.addEventListener('updatefound', () => {
        if (reg.installing) watchInstalling(reg.installing);
      });

      // SPA はページ遷移がないためブラウザが自動チェックしない
      // → 30分ごとに明示的にサーバー側の sw.js 更新を確認
      updateIntervalId = setInterval(() => {
        if (!unmounted) reg.update();
      }, 30 * 60 * 1000);
    }).catch((err) => console.warn('SW registration failed:', err));

    // activate 時の postMessage も引き続き受け取る（フォールバック）
    const msgHandler = (event: MessageEvent) => {
      if (event.data?.type === 'NEW_VERSION') notify();
    };
    navigator.serviceWorker.addEventListener('message', msgHandler);

    return () => {
      unmounted = true;
      if (updateIntervalId) clearInterval(updateIntervalId);
      navigator.serviceWorker.removeEventListener('message', msgHandler);
    };
  }, []);

  if (!showBanner) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 'calc(env(safe-area-inset-top, 0px) + 52px)',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        background: 'rgba(6,8,18,0.96)',
        border: '1px solid rgba(0,229,255,0.5)',
        boxShadow: '0 0 20px rgba(0,229,255,0.2)',
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        backdropFilter: 'blur(8px)',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--cp-text)', letterSpacing: '0.1em' }}>
        新バージョンがあります
      </span>
      <button
        onClick={() => window.location.reload()}
        style={{
          fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--cp-cyan)',
          background: 'rgba(0,229,255,0.1)', border: '1px solid rgba(0,229,255,0.4)',
          padding: '3px 8px', cursor: 'pointer', letterSpacing: '0.1em',
        }}
      >
        再読込
      </button>
    </div>
  );
}
