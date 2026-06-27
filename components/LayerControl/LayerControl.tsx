'use client';

import { useState } from 'react';
import { useDisasterStore, type LayerKey } from '@/store/useDisasterStore';

type LayerDef = { key: LayerKey; label: string; rgb: string };

type Category = {
  id: string;
  label: string;
  icon: string;
  color: string;
  layers: LayerDef[];
};

const CATEGORIES: Category[] = [
  {
    id: 'seismic',
    label: '地震・津波',
    icon: '◈',
    color: 'var(--cp-red)',
    layers: [
      { key: 'earthquake', label: '地震マーカー',   rgb: '255,23,68'  },
      { key: 'tsunami',    label: '津波マーカー',   rgb: '0,176,255'  },
      { key: 'hazard',     label: 'ハザードマップ', rgb: '255,109,0'  },
    ],
  },
  {
    id: 'weather',
    label: '降水・気象',
    icon: '◉',
    color: 'var(--cp-cyan)',
    layers: [
      { key: 'rain',        label: '雨雲レーダー', rgb: '0,229,255' },
      { key: 'thunder',     label: '雷レーダー',   rgb: '255,214,0' },
      { key: 'linearPrecip',label: '線状降水帯',       rgb: '0,176,255' },
    ],
  },
  {
    id: 'typhoon',
    label: '台風',
    icon: '◎',
    color: '#e040fb',
    layers: [
      { key: 'typhoon', label: '台風トラック', rgb: '224,64,251' },
    ],
  },
  {
    id: 'landslide',
    label: '土砂・洪水',
    icon: '◇',
    color: '#a1887f',
    layers: [
      { key: 'landslide', label: '土砂危険箇所', rgb: '161,136,127' },
    ],
  },
];

function CategorySection({ cat, open, onToggleOpen }: {
  cat: Category;
  open: boolean;
  onToggleOpen: () => void;
}) {
  const layers      = useDisasterStore((s) => s.layers);
  const toggleLayer = useDisasterStore((s) => s.toggleLayer);
  const typhoons          = useDisasterStore((s) => s.typhoons);
  const linearPrecipBands = useDisasterStore((s) => s.linearPrecipBands);
  const landslideWarnings = useDisasterStore((s) => s.landslideWarnings);

  const events = useDisasterStore((s) => s.events);

  const alertKeys: Partial<Record<LayerKey, boolean>> = {
    typhoon:      typhoons.length > 0,
    linearPrecip: linearPrecipBands.length > 0,
    landslide:    landslideWarnings.length > 0,
    tsunami:      events.some((e) => e.type === 'tsunami'),
  };

  const anyActive = cat.layers.some((l) => layers[l.key]);

  return (
    <div style={{ borderBottom: '1px solid var(--cp-border)' }} className="pb-1 mb-1">
      {/* カテゴリヘッダー */}
      <button
        onClick={onToggleOpen}
        className="w-full flex items-center gap-2 py-1 px-1 hover:bg-white/5 transition-colors"
      >
        <span style={{ color: cat.color, fontSize: 10 }}>{cat.icon}</span>
        <span style={{ color: cat.color, fontSize: 9, letterSpacing: '0.14em' }} className="uppercase">
          {cat.label}
        </span>
        {anyActive && (
          <span
            style={{ background: cat.color, width: 4, height: 4, borderRadius: '50%' }}
            className="ml-1 shrink-0"
          />
        )}
        <span style={{ color: 'var(--cp-muted)', fontSize: 9, marginLeft: 'auto' }}>
          {open ? '▲' : '▼'}
        </span>
      </button>

      {/* レイヤーリスト */}
      {open && (
        <div className="pl-3 flex flex-col gap-1 mt-1">
          {cat.layers.map(({ key, label, rgb }) => {
            const active = layers[key];
            const hasAlert = alertKeys[key];
            return (
              <button
                key={key}
                onClick={() => toggleLayer(key)}
                style={{
                  borderColor: active ? `rgb(${rgb})` : 'rgba(255,255,255,0.1)',
                  color: active ? `rgb(${rgb})` : 'var(--cp-muted)',
                  background: active ? `rgba(${rgb},0.08)` : 'transparent',
                  minHeight: 40,
                }}
                className="w-full border px-2 py-2 text-left text-[11px] tracking-wider flex items-center gap-1.5 transition-all"
              >
                <span
                  style={{ background: active ? `rgb(${rgb})` : 'var(--cp-muted)', flexShrink: 0 }}
                  className={`w-1.5 h-1.5 rounded-full ${hasAlert && !active ? 'cp-pulse' : ''}`}
                />
                <span className="truncate">{label}</span>
                {hasAlert && (
                  <span style={{ color: `rgb(${rgb})`, fontSize: 7, letterSpacing: '0.1em' }} className="ml-auto shrink-0">
                    ACTIVE
                  </span>
                )}
                <span className="text-[8px] ml-auto shrink-0">{active ? 'ON' : 'OFF'}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function LayerControl() {
  const [openCats, setOpenCats] = useState<Record<string, boolean>>({
    seismic: true, weather: true, typhoon: true, landslide: false,
  });

  return (
    <div className="cp-panel p-2">
      <span className="cp-label text-[9px] tracking-widest block mb-2">LAYERS</span>
      {CATEGORIES.map((cat) => (
        <CategorySection
          key={cat.id}
          cat={cat}
          open={openCats[cat.id] ?? true}
          onToggleOpen={() => setOpenCats((prev) => ({ ...prev, [cat.id]: !prev[cat.id] }))}
        />
      ))}
    </div>
  );
}
