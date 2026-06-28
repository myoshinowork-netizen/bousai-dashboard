import { NextResponse } from 'next/server';

export const runtime = 'edge';
export const revalidate = 300; // 5分キャッシュ

type NewsItem = {
  title: string;
  description: string;
  link: string;
  pubDate: string;
  source: string;
  sourceColor: string;
};

// ────────────────────────────────────────────────
// 汎用 RSS パーサー（CDATA 対応）
// ────────────────────────────────────────────────
function parseRssItems(xml: string, source: string, sourceColor: string, limit = 12): NewsItem[] {
  const items: NewsItem[] = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml)) !== null && items.length < limit) {
    const b = m[1];
    const get = (tag: string) =>
      (new RegExp(`<${tag}><\\!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`).exec(b) ??
       new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`).exec(b)
      )?.[1]?.trim()
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/<[^>]+>/g, '') ?? '';

    const title = get('title');
    if (!title) continue;
    const description = get('description').slice(0, 200);
    const link    = get('link').replace(/\s/g, '');
    const pubDate = get('pubDate');
    items.push({ title, description, link, pubDate, source, sourceColor });
  }
  return items;
}

// ────────────────────────────────────────────────
// ソース別フェッチ（確認済みURL）
// ────────────────────────────────────────────────
async function fetchRss(url: string, source: string, color: string, limit = 12): Promise<NewsItem[]> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CrisisGovPlatform/1.0)' },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    return parseRssItems(await res.text(), source, color, limit);
  } catch {
    return [];
  }
}

// ────────────────────────────────────────────────
// 関連性フィルター
// ────────────────────────────────────────────────
const RELEVANT_KEYWORDS = [
  '地震', '震度', 'マグニチュード', '津波', '余震', '液状化', '地盤',
  '台風', '熱帯低気圧', '暴風', '強風',
  '大雨', '豪雨', '線状降水帯', '集中豪雨', '洪水', '浸水', '冠水', '氾濫', '増水', '河川',
  '土砂', '崖崩れ', '土石流', '地すべり',
  '雷', '竜巻', '突風', 'ひょう',
  '警報', '注意報', '特別警報', '緊急', '速報', '発令',
  '避難', '避難指示', '避難命令', '避難準備', '危険',
  '災害', '防災', '減災', '被害', '死者', '行方不明', '救助',
  '高潮', '波浪', '高波', '記録的',
  '気象', '天気', '梅雨', '前線', '低気圧',
  '猛暑', '熱中症', '熱波', '酷暑',
  '大雪', '吹雪', '雪崩', '積雪', '路面凍結',
  '噴火', '火山', '火砕流', '降灰',
  '停電', '断水', 'インフラ',
];

// 海外の記事を国内関連なしで除外する
const OVERSEAS_MARKERS = [
  'アメリカ', '米国', '中国', '韓国', '北朝鮮', 'ロシア', 'ウクライナ',
  'ヨーロッパ', 'EU', 'イスラエル', 'イラン', '中東', 'インド',
  'オーストラリア', 'フランス', 'ドイツ', 'イギリス', '英国',
];
const JAPAN_MARKERS = [
  '日本', '国内', '全国',
  '都', '道', '府', '県', '市', '町', '村',
  '気象庁', '国土交通省', '消防庁', '内閣府', '環境省',
];

function isRelevant(item: NewsItem): boolean {
  const text = `${item.title} ${item.description}`;
  if (!RELEVANT_KEYWORDS.some((kw) => text.includes(kw))) return false;
  const overseas = OVERSEAS_MARKERS.some((kw) => item.title.includes(kw));
  const japan    = JAPAN_MARKERS.some((kw) => text.includes(kw));
  if (overseas && !japan) return false;
  return true;
}

// 重複排除（タイトル先頭20文字）
function dedup(items: NewsItem[]): NewsItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.title.slice(0, 20);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ────────────────────────────────────────────────
// エンドポイント
// ────────────────────────────────────────────────
export async function GET() {
  const [nhkSocial, nhkLatest, yahooJp] = await Promise.all([
    // NHK 社会 (cat1) — 国内災害・事件・気象
    fetchRss('https://www3.nhk.or.jp/rss/news/cat1.xml', 'NHK 社会', '#e8102a', 12),
    // NHK 最新15項目 (cat8) — 速報込みの最新情報
    fetchRss('https://www3.nhk.or.jp/rss/news/cat8.xml', 'NHK 速報', '#ff6d00', 15),
    // Yahoo!ニュース 国内 — 防災・気象記事が豊富
    fetchRss('https://news.yahoo.co.jp/rss/topics/domestic.xml', 'Yahoo! 国内', '#ff2d78', 15),
  ]);

  const all = dedup(
    [...yahooJp, ...nhkSocial, ...nhkLatest]
      .filter(isRelevant)
      .sort((a, b) => {
        const da = a.pubDate ? new Date(a.pubDate).getTime() : 0;
        const db = b.pubDate ? new Date(b.pubDate).getTime() : 0;
        return db - da;
      })
  );

  return NextResponse.json({ items: all }, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' },
  });
}
