'use client';

import { useDisasterStore } from '@/store/useDisasterStore';

export function AlertBanner() {
  const events    = useDisasterStore((s) => s.events);
  const emergency = events.find((e) => e.severity === 'emergency');

  if (!emergency) return null;

  return (
    <div
      className="cp-flash fixed top-0 left-0 right-0 z-50 flex items-center gap-4 px-4 py-2"
      style={{ borderBottom: '2px solid var(--cp-red)' }}
    >
      <span
        style={{ color: 'var(--cp-red)', fontFamily: 'var(--font-orbitron)', fontSize: 11 }}
        className="tracking-widest cp-pulse"
      >
        !! EMERGENCY !!
      </span>
      <span style={{ color: 'var(--cp-red)', fontSize: 12 }} className="tracking-wide font-bold">
        {emergency.title}
      </span>
      {emergency.area && (
        <span style={{ color: 'var(--cp-yellow)', fontSize: 11 }} className="tracking-wider">
          {emergency.area.slice(0, 4).join(' / ')}
        </span>
      )}
      <span className="cp-label ml-auto">
        公式情報・自治体の指示を最優先にしてください
      </span>
    </div>
  );
}
