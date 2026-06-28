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
      style={{
        borderLeft: `2px solid ${isSelected ? 'var(--cp-cyan)' : color}`,
        background: isSelected ? 'rgba(0,229,255,0.06)' : 'rgba(255,255,255,0.015)',
        padding: '7px 8px 7px 10px',
        marginBottom: 3,
        display: 'block',
        width: '100%',
        textAlign: 'left',
        cursor: 'pointer',
        transition: 'background 0.15s, border-color 0.15s',
        boxShadow: isSelected ? '0 0 10px rgba(0,229,255,0.15)' : 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
        <span style={{
          fontFamily: 'var(--font-mono)', color, fontSize: 8,
          letterSpacing: '0.14em', fontWeight: 700,
          textShadow: `0 0 6px ${color}80`,
        }}>
          {SEV_LABEL[event.severity]}
        </span>
        {badge && (
          <span style={{
            background: `rgba(${badge.rgb},0.15)`, color: `rgb(${badge.rgb})`,
            fontFamily: 'var(--font-mono)', fontSize: 7, padding: '1px 4px', letterSpacing: '0.1em',
          }}>
            {badge.label}
          </span>
        )}
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'var(--cp-text-dim)', letterSpacing: '0.08em', marginLeft: 'auto' }}>
          {formatTime(event.occurredAt)}
        </span>
      </div>
      <div style={{
        fontFamily: 'var(--font-ui)', fontWeight: 500,
        color: isSelected ? 'var(--cp-cyan)' : 'var(--cp-text)',
        fontSize: 11, letterSpacing: '0.04em', lineHeight: 1.3,
      }}>
        {event.title}
      </div>
      {event.area && (
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 7, color: 'var(--cp-text-dim)',
          letterSpacing: '0.08em', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
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
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
        paddingBottom: 8, borderBottom: '1px solid var(--cp-border)',
      }}>
        <span style={{ color: 'var(--cp-red-bright)', fontSize: 8 }}>◈</span>
        <span style={{
          fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 10,
          letterSpacing: '0.22em', color: 'var(--cp-amber)', textTransform: 'uppercase',
        }}>災害情報</span>
        {isHistorical ? (
          <span style={{
            marginLeft: 'auto', color: 'var(--cp-amber)', fontFamily: 'var(--font-mono)',
            fontSize: 8, letterSpacing: '0.14em', border: '1px solid var(--cp-amber)',
            padding: '1px 5px',
          }}>
            HIST
          </span>
        ) : (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{
              background: 'var(--cp-red-bright)', width: 5, height: 5, borderRadius: '50%',
              boxShadow: '0 0 6px var(--cp-red-glow)',
            }} className="cp-pulse" />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.16em', color: 'var(--cp-red)' }}>LIVE</span>
          </div>
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
        {filtered.length} 件{isHistorical ? '（絞り込み中）' : ''}
      </div>
    </div>
  );
}
