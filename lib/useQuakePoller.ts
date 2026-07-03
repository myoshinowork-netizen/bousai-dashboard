'use client';

import { useEffect } from 'react';
import { useDisasterStore } from '@/store/useDisasterStore';
import type { DisasterEvent } from './model';

const POLL_INTERVAL_MS = 60_000; // P2P地震情報 /jma は 10req/分 制限のため 60秒

export function useQuakePoller() {
  const addEvents      = useDisasterStore((s) => s.addEvents);
  const setLastUpdated = useDisasterStore((s) => s.setLastUpdated);

  useEffect(() => {
    async function poll() {
      try {
        const res = await fetch('/api/quake?limit=10', { cache: 'no-store' });
        if (!res.ok) return;
        const data: DisasterEvent[] = await res.json();
        addEvents(data);
        setLastUpdated(new Date().toISOString());
      } catch (e) {
        console.error('quake poll error', e);
      }
    }

    poll(); // 初回即時
    const id = setInterval(poll, POLL_INTERVAL_MS);

    // 手動更新ボタンからのイベント
    function handleRefresh() { poll(); }
    window.addEventListener('disaster-refresh', handleRefresh);

    // タブ復帰・PWA再表示時に即時更新（バックグラウンド中の欠落を補完）
    // visibilitychange の連発対策として最低15秒間隔に制限
    let lastVisiblePoll = 0;
    function handleVisible() {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastVisiblePoll < 15_000) return;
      lastVisiblePoll = Date.now();
      poll();
    }
    document.addEventListener('visibilitychange', handleVisible);
    window.addEventListener('pageshow', handleRefresh);

    return () => {
      clearInterval(id);
      window.removeEventListener('disaster-refresh', handleRefresh);
      document.removeEventListener('visibilitychange', handleVisible);
      window.removeEventListener('pageshow', handleRefresh);
    };
  }, [addEvents, setLastUpdated]);
}
