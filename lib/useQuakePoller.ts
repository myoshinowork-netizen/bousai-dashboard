'use client';

import { useEffect } from 'react';
import { useDisasterStore } from '@/store/useDisasterStore';
import type { DisasterEvent } from './model';

const POLL_INTERVAL_MS = 60_000; // P2P地震情報 /jma は 10req/分 制限のため 60秒

export function useQuakePoller() {
  const addEvents = useDisasterStore((s) => s.addEvents);

  useEffect(() => {
    async function poll() {
      try {
        const res = await fetch('/api/quake?limit=10');
        if (!res.ok) return;
        const data: DisasterEvent[] = await res.json();
        addEvents(data);
      } catch (e) {
        console.error('quake poll error', e);
      }
    }

    poll(); // 初回即時
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [addEvents]);
}
