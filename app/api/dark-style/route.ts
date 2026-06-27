import { NextResponse } from 'next/server';

const STYLE_URL = 'https://tile.openstreetmap.jp/styles/osm-bright-ja/style.json';

// 水域系レイヤーID判定
function isWaterLayer(id: string) {
  return ['water', 'ocean', 'sea', 'lake', 'river'].some((w) => id.includes(w));
}
// 道路系レイヤーID判定
function isRoadLayer(id: string) {
  return ['road', 'street', 'highway', 'motorway', 'trunk', 'path', 'railway', 'transit'].some(
    (w) => id.includes(w)
  );
}

type AnyLayer = { id: string; type: string; paint?: Record<string, unknown>; layout?: Record<string, unknown> };

// フォントをドットゴシックに変換
function remapFont(fonts: unknown): string[] {
  if (!Array.isArray(fonts)) return ['DotGothic16 Regular'];
  // bold 系はそのままドットゴシック（bold バリアントなし）
  return ['DotGothic16 Regular'];
}

function darkify(layer: AnyLayer): AnyLayer {
  const id = layer.id.toLowerCase();

  if (layer.type === 'background') {
    return { ...layer, paint: { ...layer.paint, 'background-color': '#05050a' } };
  }
  if (layer.type === 'fill') {
    return {
      ...layer,
      paint: {
        ...layer.paint,
        'fill-color': isWaterLayer(id) ? '#0a1428' : '#0d0d18',
        'fill-opacity': 1,
      },
    };
  }
  if (layer.type === 'line') {
    return {
      ...layer,
      paint: {
        ...layer.paint,
        'line-color': isRoadLayer(id) ? '#1a2235' : '#0f0f1e',
      },
    };
  }
  if (layer.type === 'symbol') {
    return {
      ...layer,
      layout: {
        ...layer.layout,
        'text-font': remapFont((layer.layout as Record<string, unknown>)?.['text-font']),
      },
      paint: {
        ...layer.paint,
        'text-color': '#e8eaff',
        'text-halo-color': '#05050a',
        'text-halo-width': 1.5,
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

    // すべてのレイヤーをダーク変換
    style.layers = (style.layers as AnyLayer[]).map(darkify);

    return NextResponse.json(style, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to fetch style' }, { status: 502 });
  }
}
