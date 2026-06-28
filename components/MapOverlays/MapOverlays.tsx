'use client';

import { useState } from 'react';
import { SituationPanel } from '@/components/SituationPanel/SituationPanel';
import { MapLegend }      from '@/components/MapLegend/MapLegend';

export function MapOverlays({ isMobile = false }: { isMobile?: boolean }) {
  const [situationOpen, setSituationOpen] = useState(
    () => typeof window === 'undefined' ? true : !window.matchMedia('(max-width: 1023px)').matches
  );

  return (
    <div
      style={{
        position: 'absolute',
        top: 8,
        left: 8,
        right: 'auto',
        zIndex: 10,
        width: isMobile ? 'min(220px, 56vw)' : 220,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        pointerEvents: 'none',
        maxHeight: isMobile ? 'calc(100svh - 120px)' : 'calc(100vh - 80px)',
      }}
    >
      {/* 状況レポート */}
      <div style={{
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        maxHeight: situationOpen
          ? (isMobile ? '45vh' : '60vh')
          : undefined,
        overflow: 'hidden',
      }}>
        <SituationPanel isMobile={isMobile} onOpenChange={setSituationOpen} />
      </div>

      {/* 凡例: 状況レポート直下に配置 */}
      <div style={{ flexShrink: 0 }}>
        <MapLegend isMobile={isMobile} />
      </div>
    </div>
  );
}
