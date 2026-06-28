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
    return { ...layer, paint: { ...layer.paint, 'background-color': '#000005' } };
  }
  if (layer.type === 'fill') {
    // 水域: 深い紺青、陸地: ほぼ黒
    if (isWaterLayer(id)) {
      return { ...layer, paint: { ...layer.paint, 'fill-color': '#060e24', 'fill-opacity': 1 } };
    }
    return { ...layer, paint: { ...layer.paint, 'fill-color': '#08091a', 'fill-opacity': 1 } };
  }
  if (layer.type === 'line') {
    if (isRoadLayer(id)) {
      // 幹線: 薄いシアン系、細道: ほぼ不可視
      return { ...layer, paint: { ...layer.paint, 'line-color': '#111830', 'line-opacity': 0.9 } };
    }
    return { ...layer, paint: { ...layer.paint, 'line-color': '#0c0d20', 'line-opacity': 0.7 } };
  }
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
        'text-color': '#7ab0e0',      // サイバー寒色系の地名
        'text-halo-color': '#000005',
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
