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
        bottom: isMobile ? 64 : 48,
        left: 8,
        right: 'auto',
        zIndex: 10,
        width: isMobile ? 200 : 220,
        zoom: isMobile ? (1 / 1.25) : 1,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        pointerEvents: 'none',
      }}
    >
      {/* SITUATION REPORT: open 時のみ flex-grow してスクロール */}
      <div style={{
        flex: situationOpen ? '1 1 auto' : '0 0 auto',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        maxHeight: isMobile ? '50vh' : undefined,
      }}>
        <SituationPanel isMobile={isMobile} onOpenChange={setSituationOpen} />
      </div>

      {/* MAP LEGEND: SituationReport 直下にスライド */}
      <div style={{ flexShrink: 0 }}>
        <MapLegend isMobile={isMobile} />
      </div>
    </div>
  );
}
