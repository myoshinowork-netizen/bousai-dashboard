'use client';

import { useEffect, useState } from 'react';
import { useDisasterStore } from '@/store/useDisasterStore';
import type { DisasterEvent } from '@/lib/model';

type NewsItem = {
  title: string;
  link: string;
  pubDate: string;
  source: string;
  sourceColor: string;
  description: string;
};

type LocalReport = {
  prefLabel: string;
  prefCode: string;
  keywords: string[];
  localNews: (NewsItem & { score: number })[];
  nearbyEvents: (DisasterEvent & { distKm: number })[];
};

const SEVERITY_COLOR: Record<string, string> = {
  emergency:  '#e8102a',
  warning:    '#ff6600',
  advisory:   '#ffaa00',
  info:       '#ffd600',
};

function severityColor(s?: string) {
  return SEVERITY_COLOR[s ?? ''] ?? '#8898b8';
}

export function LocalAlert() {
  const userLocation = useDisasterStore((s) => s.userLocation);
  const [report, setReport]     = useState<LocalReport | null>(null);
  const [loading, setLoading]   = useState(false);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (!userLocation) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/local-report?lat=${userLocation!.lat}&lng=${userLocation!.lng}`,
          { cache: 'no-store' },
        );
        if (!res.ok) return;
        const data: LocalReport = await res.json();
        if (!cancelled) setReport(data);
      } catch { /* ignore */ } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const timer = setInterval(load, 5 * 60 * 1000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [userLocation]);

  if (!userLocation) return null;

  return (
    <div style={{
      borderBottom: '1px solid rgba(255,170,0,0.2)',
      background: 'rgba(255,170,0,0.03)',
    }}>
      {/* Header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 10px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          borderBottom: expanded ? '1px solid rgba(255,170,0,0.15)' : 'none',
        }}
      >
        <span style={{ color: 'var(--cp-amber)', fontSize: 9 }}>◈</span>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 8,
          letterSpacing: '0.18em',
          color: 'var(--cp-amber)',
          textTransform: 'uppercase' as const,
          flex: 1,
          textAlign: 'left' as const,
        }}>
          あなたの周辺{report ? ` — ${report.prefLabel}` : ''}
        </span>
        {loading && (
          <span style={{ color: 'var(--cp-amber)', fontSize: 8, opacity: 0.6 }}>●</span>
        )}
        <span style={{ color: 'var(--cp-amber)', fontSize: 8, opacity: 0.5 }}>
          {expanded ? '▲' : '▼'}
        </span>
      </button>

      {expanded && report && (
        <div style={{ padding: '6px 0 4px' }}>
          {/* 近くの地震 */}
          {report.nearbyEvents.length > 0 && (
            <div style={{ marginBottom: 6 }}>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 7,
                letterSpacing: '0.14em',
                color: 'var(--cp-text-dim)',
                padding: '0 10px',
                marginBottom: 4,
              }}>
                ◇ 周辺の地震（200km以内）
              </div>
              {report.nearbyEvents.map((ev) => (
                <div
                  key={ev.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 6,
                    padding: '3px 10px',
                    borderLeft: `2px solid ${severityColor(ev.severity)}`,
                    marginLeft: 10,
                    marginBottom: 3,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: 'var(--font-ui)',
                      fontSize: 10,
                      color: 'var(--cp-text)',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {ev.title}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--cp-text-dim)', marginTop: 1 }}>
                      {new Date(ev.occurredAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <div style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 9,
                    color: 'var(--cp-amber)',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}>
                    {Math.round(ev.distKm)}km
                  </div>
                </div>
              ))}
            </div>
          )}

          {report.nearbyEvents.length === 0 && (
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 8,
              color: 'var(--cp-text-dim)',
              padding: '2px 10px 6px',
            }}>
              ◇ 周辺200km以内に最近の地震なし
            </div>
          )}

          {/* 地域ニュース */}
          {report.localNews.length > 0 && (
            <div>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 7,
                letterSpacing: '0.14em',
                color: 'var(--cp-text-dim)',
                padding: '0 10px',
                marginBottom: 4,
                marginTop: 4,
              }}>
                ◇ 地域の最新情報
              </div>
              {report.localNews.map((item, i) => (
                <a
                  key={i}
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'block',
                    padding: '4px 10px',
                    textDecoration: 'none',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                  }}
                >
                  <div style={{
                    fontFamily: 'var(--font-ui)',
                    fontSize: 10,
                    color: 'var(--cp-cyan)',
                    lineHeight: 1.35,
                    marginBottom: 2,
                  }}>
                    {item.title}
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 7,
                      color: item.sourceColor ?? 'var(--cp-text-dim)',
                      border: `1px solid ${item.sourceColor ?? 'rgba(255,255,255,0.15)'}`,
                      padding: '0 3px',
                    }}>
                      {item.source}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'var(--cp-text-dim)' }}>
                      {item.pubDate ? new Date(item.pubDate).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {expanded && !report && !loading && (
        <div style={{ padding: '8px 10px', fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--cp-text-dim)' }}>
          位置情報を取得中…
        </div>
      )}
    </div>
  );
}
