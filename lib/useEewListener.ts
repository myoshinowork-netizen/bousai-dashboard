'use client';

import { useEffect } from 'react';
import { useDisasterStore } from '@/store/useDisasterStore';
import type { EewData } from '@/lib/model';

// P2P地震情報 WebSocket (無料・登録不要)
const WS_URL = 'wss://api.p2pquake.net/v2/ws';

function parseDate(s: string): string {
  // "2024/01/01 12:00:00" → ISO8601
  return s.replace(/(\d{4})\/(\d{2})\/(\d{2}) (\d{2}:\d{2}:\d{2})/, '$1-$2-$3T$4+09:00');
}

export function useEewListener() {
  const setEewAlert = useDisasterStore((s) => s.setEewAlert);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let dismissed = false;

    function connect() {
      if (dismissed) return;
      ws = new WebSocket(WS_URL);

      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data as string);
          // 554 = EEW予報  555 = EEW警報
          if (data.code !== 554 && data.code !== 555) return;

          const eq = data.earthquake;
          if (!eq?.hypocenter?.latitude || eq.hypocenter.latitude === -200) return;

          const eew: EewData = {
            id:            data.issue?.eventId ?? String(Date.now()),
            serial:        data.issue?.serial  ?? 1,
            issuedAt:      parseDate(data.time ?? new Date().toISOString()),
            quakeTime:     parseDate(eq.time   ?? data.time ?? new Date().toISOString()),
            epicenterName: eq.hypocenter.name  ?? '不明',
            lat:           eq.hypocenter.latitude,
            lng:           eq.hypocenter.longitude,
            depth:         eq.hypocenter.depth     ?? 0,
            magnitude:     eq.hypocenter.magnitude ?? 0,
            maxScale:      eq.maxScale ?? 0,
            isFinal:       data.isFinal ?? false,
            isWarning:     data.code === 555,
          };
          setEewAlert(eew);
        } catch {
          // ignore parse errors
        }
      };

      ws.onclose = () => {
        if (!dismissed) {
          reconnectTimer = setTimeout(connect, 5000);
        }
      };

      ws.onerror = () => ws?.close();
    }

    connect();

    return () => {
      dismissed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [setEewAlert]);
}
