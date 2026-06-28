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

    navigator.serviceWorker.register('/sw.js').catch((err) => console.warn('SW registration failed:', err));

    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'NEW_VERSION') {
        setShowBanner(true);
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
