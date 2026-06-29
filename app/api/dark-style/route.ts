import { NextResponse } from 'next/server';

const STYLE_URL = 'https://tile.openstreetmap.jp/styles/osm-bright-ja/style.json';

// osm-bright-ja の実レイヤー ID（fetch で確認済み）:
//   boundary-land-level-4 → 都道府県境
//   boundary-land-level-2 → 国境
//   boundary-land-disputed → 係争地
//   boundary-water        → 水域境界

// ── レイヤー分類 ─────────────────────────────────
function isWaterLayer(id: string) {
  return ['water', 'ocean', 'sea', 'lake', 'river'].some((w) => id.includes(w));
}
function isRoadLayer(id: string) {
  return ['road', 'street', 'highway', 'motorway', 'trunk', 'path', 'railway', 'transit'].some(
    (w) => id.includes(w)
  );
}
function isLandBoundary(id: string) {
  return id.startsWith('boundary-land');
}

type AnyLayer = {
  id: string;
  type: string;
  paint?: Record<string, unknown>;
  layout?: Record<string, unknown>;
};

function remapFont(_fonts: unknown): string[] {
  return ['DotGothic16 Regular'];
}

function landBoundaryStyle(id: string): { color: string; opacity: number; width: number } {
  if (id === 'boundary-land-level-2') {
    // 国境: 明るいシアン
    return { color: '#00cfff', opacity: 0.6, width: 1.2 };
  }
  if (id === 'boundary-land-level-4') {
    // 都道府県境: 少し抑えたシアン・青
    return { color: '#0080b0', opacity: 0.8, width: 0.8 };
  }
  // 係争地: オレンジ系
  return { color: '#b06000', opacity: 0.55, width: 0.7 };
}

function darkify(layer: AnyLayer): AnyLayer {
  const id = layer.id.toLowerCase();

  // ── 背景 ─────────────────────────────────────
  if (layer.type === 'background') {
    return { ...layer, paint: { ...layer.paint, 'background-color': '#00020e' } };
  }

  // ── 行政境界線（都道府県・国境）: UI シアン系で縁取り ──
  if (isLandBoundary(id) && layer.type === 'line') {
    const { color, opacity, width } = landBoundaryStyle(id);
    return {
      ...layer,
      paint: {
        ...layer.paint,
        'line-color': color,
        'line-opacity': opacity,
        'line-width': width,
        'line-blur': 0,
      },
    };
  }

  // ── fill ─────────────────────────────────────
  if (layer.type === 'fill') {
    if (isWaterLayer(id) || id === 'boundary-water') {
      return { ...layer, paint: { ...layer.paint, 'fill-color': '#060d21', 'fill-opacity': 1 } };
    }
    // 陸地: 従来より少し明るく
    return { ...layer, paint: { ...layer.paint, 'fill-color': '#0c0f26', 'fill-opacity': 1 } };
  }

  // ── line ─────────────────────────────────────
  if (layer.type === 'line') {
    if (isRoadLayer(id)) {
      if (id.includes('motorway') || id.includes('trunk') || id.includes('primary')) {
        return { ...layer, paint: { ...layer.paint, 'line-color': '#16203e', 'line-opacity': 0.9 } };
      }
      return { ...layer, paint: { ...layer.paint, 'line-color': '#0e1530', 'line-opacity': 0.7 } };
    }
    if (id.includes('coast') || id.includes('shore')) {
      return { ...layer, paint: { ...layer.paint, 'line-color': '#003d5c', 'line-opacity': 0.8 } };
    }
    return { ...layer, paint: { ...layer.paint, 'line-color': '#0a0d22', 'line-opacity': 0.6 } };
  }

  // ── symbol（地名テキスト）────────────────────
  if (layer.type === 'symbol') {
    return {
      ...layer,
      layout: {
        ...layer.layout,
        'text-font': remapFont((layer.layout as Record<string, unknown>)?.['text-font']),
        'text-letter-spacing': 0.05,
      },
      paint: {
        ...layer.paint,
        'text-color': '#6aa8d8',
        'text-halo-color': '#00020e',
        'text-halo-width': 1.8,
      },
    };
  }

  return layer;
}

export async function GET() {
  try {
    const res = await fetch(STYLE_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`style fetch failed: ${res.status}`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const style: any = await res.json();

    style.layers = (style.layers as AnyLayer[]).map(darkify);

    return NextResponse.json(style, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to fetch style' }, { status: 502 });
  }
}
