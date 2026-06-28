import { NextResponse } from 'next/server';

export const runtime = 'edge';
export const revalidate = 300; // 5分キャッシュ

type NewsItem = {
  title: string;
  description: string;
  link: string;
  pubDate: string;
  source: string;
};

async function fetchNhkRss(): Promise<NewsItem[]> {
  try {
    // NHK 社会・防災カテゴリ RSS
    const res = await fetch('https://www3.nhk.or.jp/rss/news/cat6.xml', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CrisisGovPlatform/1.0)' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const xml = await res.text();

    const items: NewsItem[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let m: RegExpExecArray | null;
    while ((m = itemRegex.exec(xml)) !== null && items.length < 8) {
      const block = m[1];
      const title       = (/<title><!\[CDATA\[(.*?)\]\]><\/title>/.exec(block) ?? /<title>(.*?)<\/title>/.exec(block))?.[1]?.trim() ?? '';
      const description = (/<description><!\[CDATA\[(.*?)\]\]><\/description>/.exec(block) ?? /<description>(.*?)<\/description>/.exec(block))?.[1]?.trim() ?? '';
      const link        = (/<link>(.*?)<\/link>/.exec(block))?.[1]?.trim() ?? '';
      const pubDate     = (/<pubDate>(.*?)<\/pubDate>/.exec(block))?.[1]?.trim() ?? '';
      if (title) items.push({ title, description, link, pubDate, source: 'NHK NEWS' });
    }
    return items;
  } catch {
    return [];
  }
}

async function fetchNhkWeatherRss(): Promise<NewsItem[]> {
  try {
    // NHK 気象・天気カテゴリ
    const res = await fetch('https://www3.nhk.or.jp/rss/news/cat5.xml', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CrisisGovPlatform/1.0)' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const xml = await res.text();

    const items: NewsItem[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let m: RegExpExecArray | null;
    while ((m = itemRegex.exec(xml)) !== null && items.length < 5) {
      const block = m[1];
      const title       = (/<title><!\[CDATA\[(.*?)\]\]><\/title>/.exec(block) ?? /<title>(.*?)<\/title>/.exec(block))?.[1]?.trim() ?? '';
      const description = (/<description><!\[CDATA\[(.*?)\]\]><\/description>/.exec(block) ?? /<description>(.*?)<\/description>/.exec(block))?.[1]?.trim() ?? '';
      const link        = (/<link>(.*?)<\/link>/.exec(block))?.[1]?.trim() ?? '';
      const pubDate     = (/<pubDate>(.*?)<\/pubDate>/.exec(block))?.[1]?.trim() ?? '';
      if (title) items.push({ title, description, link, pubDate, source: 'NHK 気象' });
    }
    return items;
  } catch {
    return [];
  }
}

// アプリ対象コンテンツのキーワード
const RELEVANT_KEYWORDS = [
  '地震', '震度', 'マグニチュード', '津波', '余震',
  '台風', '熱帯低気圧', '暴風', '強風',
  '大雨', '豪雨', '線状降水帯', '集中豪雨', '洪水', '浸水', '冠水', '氾濫',
  '土砂', '崖崩れ', '土石流', '地すべり',
  '雷', '竜巻', '突風',
  '警報', '注意報', '特別警報', '緊急',
  '避難', '避難指示', '避難勧告', '避難準備',
  '災害', '防災', '減災',
  '高潮', '波浪', '強雨', '記録的',
  '気象', '天気', '梅雨', '前線',
];

function isRelevant(item: NewsItem): boolean {
  const text = `${item.title} ${item.description}`;
  return RELEVANT_KEYWORDS.some((kw) => text.includes(kw));
}

export async function GET() {
  const [disaster, weather] = await Promise.all([fetchNhkRss(), fetchNhkWeatherRss()]);

  // 関連キーワードでフィルタ → pubDate でソート
  const all = [...disaster, ...weather]
    .filter(isRelevant)
    .sort((a, b) => {
      const da = a.pubDate ? new Date(a.pubDate).getTime() : 0;
      const db = b.pubDate ? new Date(b.pubDate).getTime() : 0;
      return db - da;
    });

  return NextResponse.json({ items: all }, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' },
  });
}
