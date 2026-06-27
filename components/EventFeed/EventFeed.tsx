'use client';

import { useMemo } from 'react';
import { useDisasterStore } from '@/store/useDisasterStore';
import type { DisasterEvent, DisasterEventType, Severity } from '@/lib/model';
import type { LayerKey } from '@/store/useDisasterStore';

const EVENT_TYPE_TO_LAYER: Partial<Record<DisasterEventType, LayerKey>> = {
  earthquake:    'earthquake',
  tsunami:       'tsunami',
  flood:         'hazard',
  rain:          'rain',
  thunder:       'thunder',
  linear_precip: 'linearPrecip',
  typhoon:       'typhoon',
  landslide:     'landslide',
};

const SEV_COLOR: Record<Severity, string> = {
  info:      'var(--cp-muted)',
  advisory:  'var(--cp-yellow)',
  warning:   'var(--cp-orange)',
  emergency: 'var(--cp-red)',
};

const SEV_LABEL: Record<Severity, string> = {
  info:      'INFO',
  advisory:  'ADV',
  warning:   'WARN',
  emergency: '!!EMRG',
};

const TYPE_BADGE: Partial<Record<DisasterEventType, { label: string; rgb: string }>> = {
  typhoon:       { label: '台風',  rgb: '224,64,251' },
  linear_precip: { label: '線状', rgb: '0,176,255'   },
  landslide:     { label: '土砂', rgb: '161,136,127' },
  thunder:       { label: '雷',   rgb: '255,214,0'   },
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('ja-JP', {
    month: '2-digit', day: '2-digit',
    hour: '2-digit',  minute: '2-digit',
  });
}

function EventItem({ event }: { event: DisasterEvent }) {
  const selectEvent = useDisasterStore((s) => s.selectEvent);
  const enableLayer = useDisasterStore((s) => s.enableLayer);
  const selected    = useDisasterStore((s) => s.selectedEvent);
  const isSelected  = selected?.id === event.id;
  const color       = SEV_COLOR[event.severity];
  const badge       = TYPE_BADGE[event.type];

  function handleClick() {
    if (isSelected) {
      selectEvent(null);
    } else {
      selectEvent(event);
      const layerKey = EVENT_TYPE_TO_LAYER[event.type];
      if (layerKey) enableLayer(layerKey);
    }
  }

  return (
    <button
      onClick={handleClick}
      style={{ borderLeftColor: color, background: isSelected ? `rgba(0,229,255,0.05)` : 'transparent' }}
      className="w-full text-left border-l-2 pl-3 py-2 mb-1 transition-colors hover:bg-white/5"
    >
      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
        <span style={{ color, fontSize: 9 }} className="tracking-widest font-bold">
          {SEV_LABEL[event.severity]}
        </span>
        {badge && (
          <span style={{ background: `rgba(${badge.rgb},0.15)`, color: `rgb(${badge.rgb})`, fontSize: 8, padding: '1px 4px', letterSpacing: '0.1em' }}>
            {badge.label}
          </span>
        )}
        <span className="cp-label">{formatTime(event.occurredAt)}</span>
      </div>
      <div style={{ color: isSelected ? 'var(--cp-cyan)' : 'var(--cp-text)' }} className="text-xs tracking-wide">
        {event.title}
      </div>
      {event.area && (
        <div className="cp-label mt-0.5 truncate">
          {event.area.slice(0, 3).join(' · ')}
        </div>
      )}
    </button>
  );
}

export function EventFeed() {
  const events       = useDisasterStore((s) => s.events);
  const selectedTime = useDisasterStore((s) => s.selectedTime);

  // タイムラインが設定されている場合、選択時刻の前後3時間を表示
  // ライブモード(null)の場合はすべて表示
  const filtered = useMemo(() => {
    const sorted = [...events].sort(
      (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
    );
    if (selectedTime === null) return sorted;
    const t = selectedTime;
    const WINDOW_MS = 3 * 60 * 60 * 1000; // ±3h
    return sorted.filter((e) => {
      const et = new Date(e.occurredAt).getTime();
      return et <= t && et >= t - WINDOW_MS * 2;
    });
  }, [events, selectedTime]);

  const isHistorical = selectedTime !== null;

  return (
    <div className="h-full overflow-y-auto p-3">
      <div className="flex items-center gap-2 mb-3">
        <span className="cp-title">EVENT FEED</span>
        {isHistorical ? (
          <span style={{ color: 'var(--cp-yellow)', fontSize: 9, letterSpacing: '0.12em' }} className="ml-auto border border-current px-1">
            HIST
          </span>
        ) : (
          <>
            <span style={{ background: 'var(--cp-red)', width: 6, height: 6 }} className="rounded-full cp-pulse ml-auto" />
            <span className="cp-label">LIVE</span>
          </>
        )}
      </div>

      {isHistorical && (
        <div style={{ color: 'var(--cp-yellow)', fontSize: 9, letterSpacing: '0.1em', marginBottom: 8, textAlign: 'center' }}>
          {new Date(selectedTime).toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })} 時点
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="cp-label text-center py-8">
          {isHistorical ? 'この時間帯のイベントなし' : 'LOADING...'}
        </p>
      ) : (
        filtered.map((e) => <EventItem key={e.id} event={e} />)
      )}

      <div className="cp-label text-center pt-4 pb-2">
        {filtered.length} EVENTS{isHistorical ? ' (FILTERED)' : ''}
      </div>
    </div>
  );
}
