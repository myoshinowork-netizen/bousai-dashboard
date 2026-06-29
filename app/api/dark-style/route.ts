import { NextResponse } from 'next/server';

const STYLE_URL = 'https://tile.openstreetmap.jp/styles/osm-bright-ja/style.json';

// osm-bright-ja の実レイヤー ID（fetch で確認済み）:
//   boundary-land-level-4 → 都道府県境
//   boundary-land-level-2 → 国境
//   boundary-land-disputed → 係争地
//   boundary-water        → 水域境界
//   place-country-1/2/3/other → 国名ラベル
//   place-city / place-town / place-village 等 → 地名ラベル

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

// 行政境界ネオンカラー
function landBoundaryNeon(id: string): { color: string; opacity: number; width: number; blur: number } {
  if (id === 'boundary-land-level-2') {
    // 国境: 明るいネオンシアン、グロウ
    return { color: '#00ffee', opacity: 0.75, width: 1.4, blur: 1.0 };
  }
  if (id === 'boundary-land-level-4') {
    // 都道府県境: 青緑ネオン
    return { color: '#00aacc', opacity: 0.85, width: 0.9, blur: 0.5 };
  }
  // 係争地: オレンジネオン
  return { color: '#ff9900', opacity: 0.55, width: 0.7, blur: 0 };
}

function darkify(layer: AnyLayer): AnyLayer {
  const id = layer.id.toLowerCase();

  // ── 背景 ─────────────────────────────────────
  if (layer.type === 'background') {
    return { ...layer, paint: { ...layer.paint, 'background-color': '#00020e' } };
  }

  // ── 行政境界線: ネオン縁取り ─────────────────
  if (isLandBoundary(id) && layer.type === 'line') {
    const { color, opacity, width, blur } = landBoundaryNeon(id);
    return {
      ...layer,
      paint: {
        ...layer.paint,
        'line-color': color,
        'line-opacity': opacity,
        'line-width': width,
        'line-blur': blur,
      },
    };
  }

  // ── fill ─────────────────────────────────────
  if (layer.type === 'fill') {
    if (isWaterLayer(id) || id === 'boundary-water') {
      return { ...layer, paint: { ...layer.paint, 'fill-color': '#060d21', 'fill-opacity': 1 } };
    }
    // 陸地: わずかに明るく
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
      return { ...layer, paint: { ...layer.paint, 'line-color': '#004060', 'line-opacity': 0.8 } };
    }
    return { ...layer, paint: { ...layer.paint, 'line-color': '#0a0d22', 'line-opacity': 0.6 } };
  }

  // ── symbol（地名テキスト）: ネオングロウ ────────
  if (layer.type === 'symbol') {
    // 国名・都市名の大きさに応じてネオン色を変える
    const isCountry = id.includes('country');
    const isCity    = id.includes('city') || id.includes('capital') || id.includes('town');
    const textColor = isCountry ? '#00ffee' : isCity ? '#00e5ff' : '#00c8ee';
    const haloColor = isCountry ? '#004455' : isCity ? '#003d5c' : '#002840';
    const haloWidth = isCountry ? 2.5 : isCity ? 2.2 : 2.0;

    return {
      ...layer,
      layout: {
        ...layer.layout,
        'text-font': remapFont((layer.layout as Record<string, unknown>)?.['text-font']),
        'text-letter-spacing': 0.05,
      },
      paint: {
        ...layer.paint,
        'text-color': textColor,
        'text-halo-color': haloColor,
        'text-halo-width': haloWidth,
        // text-halo-blur でネオングロウ感を演出
        'text-halo-blur': 1.5,
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
