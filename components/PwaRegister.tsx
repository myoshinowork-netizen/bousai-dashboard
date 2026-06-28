'use client';

import { useEffect, useState } from 'react';

export function PwaRegister() {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // SW登録
    navigator.serviceWorker
      .register('/sw.js')
      .catch((err) => console.warn('SW registration failed:', err));

    // 新バージョン適用の通知を受け取る
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'NEW_VERSION') {
        // 3秒後に自動リロード（ユーザーに気づかせる猶予）
        setShowBanner(true);
        setTimeout(() => {
          window.location.reload();
        }, 3000);
      }
    };

    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
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
        gap: 8,
        backdropFilter: 'blur(8px)',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ color: 'var(--cp-cyan)', fontSize: 10, animation: 'spin 1s linear infinite', display: 'inline-block' }}>◈</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--cp-text)', letterSpacing: '0.1em' }}>
        新バージョンを適用中…
      </span>
    </div>
  );
}
