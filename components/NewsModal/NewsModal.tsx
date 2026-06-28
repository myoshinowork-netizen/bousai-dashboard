'use client';

import { useMemo, useEffect, useState } from 'react';
import { useDisasterStore } from '@/store/useDisasterStore';
import type { DisasterEvent } from '@/lib/model';

// ────────────────────────────────────────────────
// 型
// ────────────────────────────────────────────────
type Level = 'info' | 'advisory' | 'warning' | 'emergency';

type NewsCard = {
  id: string;
  icon: string;
  title: string;
  statusLines: string[];
  bodyLines: string[];
  level: Level;
  actions: string[];
  links: { label: string; url: string }[];
};

type ExternalItem = {
  title: string;
  description: string;
  link: string;
  pubDate: string;
  source: string;
};

const LEVEL_COLOR: Record<Level, string> = {
  emergency: '#ff1744',
  warning:   '#ff6d00',
  advisory:  '#ffd600',
  info:      '#546e7a',
};
const LEVEL_LABEL: Record<Level, string> = {
  emergency: '緊急',
  warning:   '警報',
  advisory:  '注意報',
  info:      '情報',
};

function sev(e: DisasterEvent): Level {
  return e.severity === 'emergency' ? 'emergency' : e.severity === 'warning' ? 'warning' : e.severity === 'advisory' ? 'advisory' : 'info';
}
function maxSev(events: DisasterEvent[]): Level {
  const rank: Record<Level, number> = { emergency: 4, warning: 3, advisory: 2, info: 1 };
  return events.reduce<Level>((m, e) => (rank[sev(e)] > rank[m] ? sev(e) : m), 'info');
}
function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ────────────────────────────────────────────────
// カード生成
// ────────────────────────────────────────────────
function buildCards(
  events: ReturnType<typeof useDisasterStore.getState>['events'],
  typhoons: ReturnType<typeof useDisasterStore.getState>['typhoons'],
  linearPrecipBands: ReturnType<typeof useDisasterStore.getState>['linearPrecipBands'],
  landslideWarnings: ReturnType<typeof useDisasterStore.getState>['landslideWarnings'],
  layers: ReturnType<typeof useDisasterStore.getState>['layers'],
): NewsCard[] {
  const cards: NewsCard[] = [];

  // ── 地震 ─────────────────────────────────────
  const quakes = events.filter((e) => e.type === 'earthquake');
  if (quakes.length > 0) {
    const sorted = [...quakes].sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
    const worst  = quakes.reduce((a, b) => ({ emergency: 4, warning: 3, advisory: 2, info: 1 }[sev(a)] >= { emergency: 4, warning: 3, advisory: 2, info: 1 }[sev(b)] ? a : b));
    const recent = quakes.filter((e) => Date.now() - new Date(e.occurredAt).getTime() < 3600_000);
    const mag    = worst.title.match(/M[\d.]+/)?.[0] ?? '';
    const area   = worst.area?.[0] ?? worst.title.slice(0, 12);
    const level  = maxSev(quakes);

    cards.push({
      id: 'earthquake', icon: '⚡', title: '地震情報', level,
      statusLines: [
        `最大規模: ${worst.title} — ${area}`,
        `直近1時間: ${recent.length}件 ／ 過去24時間: ${quakes.length}件`,
        `最新発生: ${fmtDateTime(sorted[0].occurredAt)}`,
      ],
      bodyLines: [
        `${area}を中心に地震活動が継続しています。`,
        mag ? `最大は${mag}で、${level === 'emergency' ? '強い揺れが広い範囲で観測' : level === 'warning' ? '一部地域で有感地震' : '小規模の揺れ'}が確認されています。` : '',
        level === 'emergency'
          ? '津波の可能性を確認し、揺れがおさまったらすぐに安全な場所へ避難してください。'
          : level === 'warning'
          ? '要配慮者（高齢者・障害者・乳幼児）は早めの避難準備を始めてください。'
          : '引き続き最新の地震情報に注意してください。',
        `直近の主な震源地: ${[...new Set(quakes.flatMap((e) => e.area ?? []))].slice(0, 5).join('・') || '確認中'}`,
      ].filter(Boolean),
      actions: level === 'emergency'
        ? ['【全員避難】津波警報の確認後、高台へ移動', '火災・落下物に注意し建物から離れる', '余震に備え倒壊危険物から距離を置く']
        : level === 'warning'
        ? ['【要配慮者避難】高齢者・障害者は先行避難', '落下物・転倒危険箇所を把握する', '避難場所・経路を家族と確認']
        : ['非常持ち出し品を玄関に用意', '避難場所・家族連絡先を確認', '最新の気象庁情報を定期確認'],
      links: [
        { label: '気象庁 地震情報', url: 'https://www.jma.go.jp/bosai/quake/' },
        { label: '気象庁 震度データベース', url: 'https://www.data.jma.go.jp/eqdb/data/shindo/' },
        { label: 'P2P地震情報', url: 'https://www.p2pquake.net/' },
        { label: '防災科研 地震観測', url: 'https://www.bosai.go.jp/' },
      ],
    });
  }

  // ── 津波 ─────────────────────────────────────
  const tsunamis = events.filter((e) => e.type === 'tsunami');
  if (tsunamis.length > 0) {
    const worst = tsunamis.reduce((a, b) =>
      ({ emergency: 4, warning: 3, advisory: 2, info: 1 }[sev(a)] >= { emergency: 4, warning: 3, advisory: 2, info: 1 }[sev(b)] ? a : b));
    const level  = sev(worst);
    const areas  = worst.area?.join('・') ?? '複数地域';
    const wLabel = level === 'emergency' ? '大津波警報' : level === 'warning' ? '津波警報' : level === 'advisory' ? '津波注意報' : '津波情報';
    cards.push({
      id: 'tsunami', icon: '🌊', title: '津波情報', level,
      statusLines: [`${wLabel}発令中 ／ ${worst.title}`, `対象地域: ${areas}`, `件数: ${tsunamis.length}件`],
      bodyLines: [
        `${wLabel}が発令されています。`,
        level === 'emergency'
          ? '沿岸・河口・低地から今すぐ離れ、高台または津波避難ビルへ避難してください。車を使わず、徒歩で高い場所を目指してください。'
          : level === 'warning'
          ? '海岸・河口付近から直ちに離れ、指定避難場所または高台へ移動してください。'
          : '海水浴・釣りなど沿岸の活動は中止し、海岸から離れてください。注意報解除まで戻らないでください。',
      ],
      actions: level === 'emergency'
        ? ['【全員今すぐ避難】高台・津波避難ビルへ', '海岸・低地・地下街から離れる', '警報解除まで絶対に海に近づかない']
        : ['【沿岸から離れる】海岸・河口付近を離れる', '津波避難場所を確認する', '次の情報を高台で待機して確認'],
      links: [
        { label: '気象庁 津波情報', url: 'https://www.jma.go.jp/bosai/tsunami/' },
        { label: '国土地理院 津波浸水想定', url: 'https://disaportal.gsi.go.jp/' },
        { label: '内閣府 津波避難', url: 'https://www.bousai.go.jp/jishin/tsunami/' },
      ],
    });
  }

  // ── 台風・熱帯低気圧 ─────────────────────────
  if (typhoons.length > 0) {
    const catLabel: Record<string, string> = { TY: '台風', STS: '強熱帯暴風雨', TS: '熱帯暴風雨', TD: '熱帯低気圧', ET: '温帯低気圧' };
    const active  = typhoons.filter((t) => ['TY', 'STS', 'TS'].includes(t.category));
    const minP    = Math.min(...typhoons.filter((t) => t.pressureHPa).map((t) => t.pressureHPa!));
    const level: Level = minP < 920 ? 'emergency' : minP < 950 ? 'emergency' : minP < 970 ? 'warning' : active.length > 0 ? 'advisory' : 'info';
    cards.push({
      id: 'typhoon', icon: '🌀', title: '台風・熱帯低気圧', level,
      statusLines: typhoons.map((t) => `${catLabel[t.category] ?? '熱帯じょう乱'} ${t.name}${t.pressureHPa ? ` ／ 中心気圧 ${t.pressureHPa}hPa` : ''}`),
      bodyLines: [
        `現在 ${typhoons.length}個の熱帯性低気圧が活動中（うち${active.length}個が強度域）。`,
        minP < 9999 ? `最低中心気圧 ${minP}hPa。${minP < 950 ? '非常に強い勢力で、暴風・高波・大雨が予想されます。' : minP < 970 ? '強い勢力で接近中。大雨・暴風に警戒が必要です。' : '今後の発達・進路に注意してください。'}` : '',
        '気象庁の台風情報・進路予報を定期的に確認し、早めの備えをしてください。',
      ].filter(Boolean),
      actions: level === 'emergency'
        ? ['【早期避難】暴風到達前に避難を完了させる', '浸水・土砂危険区域から離れる', '河川・海岸・山際に近づかない', '自治体の避難指示に従う']
        : level === 'warning'
        ? ['【避難準備】非常持ち出し品・食料を確保', '浸水想定区域内の方は避難を検討', '窓の施錠・雨戸・飛散防止を実施']
        : ['台風の進路・勢力を定期的に確認', '非常持ち出し品を準備しておく', '排水溝・側溝の詰まりを解消'],
      links: [
        { label: '気象庁 台風情報', url: 'https://www.jma.go.jp/bosai/map.html#13/typhoon' },
        { label: '気象庁 天気図（解析）', url: 'https://www.jma.go.jp/bosai/weather_map/' },
        { label: 'デジタル台風（詳細）', url: 'https://agora.ex.nii.ac.jp/digital-typhoon/' },
        { label: '気象庁 暴風域予報', url: 'https://www.jma.go.jp/bosai/typhoon/' },
      ],
    });
  }

  // ── 線状降水帯 ────────────────────────────────
  const lpBands  = linearPrecipBands;
  const lpEvents = events.filter((e) => e.type === 'linear_precip');
  if (lpBands.length > 0 || lpEvents.length > 0) {
    const count = lpBands.length > 0 ? lpBands.length : lpEvents.length;
    const areas = lpBands.length > 0
      ? lpBands.map((b) => b.area).join('・')
      : [...new Set(lpEvents.flatMap((e) => e.area ?? []))].join('・') || '複数地域';
    cards.push({
      id: 'linearPrecip', icon: '⛈', title: '線状降水帯', level: 'emergency',
      statusLines: [`${count}件発生中 ／ ${areas}`, '極めて激しい雨が長時間継続'],
      bodyLines: [
        '線状降水帯（帯状の強雨域）が確認されています。',
        '同一地域に1時間 50〜100mm を超える極めて激しい雨が長時間降り続き、甚大な浸水・河川氾濫・土砂災害が発生または切迫しています。',
        '自治体の避難指示が出た場合は直ちに行動してください。',
      ],
      actions: ['【全員今すぐ避難】河川・崖・低地から離れる', '地下・半地下・車道冠水路に入らない', '自治体の緊急情報に即座に従う', '浸水時はドアが開かなくなる前に脱出'],
      links: [
        { label: '気象庁 大雨・洪水警報', url: 'https://www.jma.go.jp/bosai/warning/' },
        { label: '気象庁 雨雲ナウキャスト', url: 'https://www.jma.go.jp/bosai/nowc/' },
        { label: '気象庁 危険度分布', url: 'https://www.jma.go.jp/bosai/risk/' },
      ],
    });
  }

  // ── 土砂災害 ─────────────────────────────────
  const lsWarn = landslideWarnings;
  const lsEv   = events.filter((e) => e.type === 'landslide');
  if (lsWarn.length > 0 || lsEv.length > 0) {
    const count   = lsWarn.length > 0 ? lsWarn.length : lsEv.length;
    const areas   = lsWarn.length > 0
      ? [...new Set(lsWarn.map((w) => w.prefecture))].join('・')
      : [...new Set(lsEv.flatMap((e) => e.area ?? []))].join('・') || '複数地域';
    const isEmerg = lsWarn.some((w) => w.level === 'emergency') || lsEv.some((e) => e.severity === 'emergency');
    const level: Level = isEmerg ? 'emergency' : 'warning';
    cards.push({
      id: 'landslide', icon: '⛰', title: '土砂災害警戒情報', level,
      statusLines: [`${isEmerg ? '緊急警戒情報' : '警戒情報'} ${count}件 ／ ${areas}`, isEmerg ? '崖崩れ・土石流が切迫' : '崖崩れ・土石流に警戒'],
      bodyLines: [
        isEmerg
          ? '土砂災害緊急警戒情報が発令されています。命に危険が及ぶ状況です。'
          : '土砂災害警戒情報が発令されています。崖崩れ・土石流・地すべりの危険があります。',
        '山際・渓流沿い・急斜面付近にいる方は今すぐ避難してください。',
        '土砂の流れる音、地鳴り、湧き水の増加など異変を感じたら即時避難してください。',
      ],
      actions: isEmerg
        ? ['【今すぐ避難】崖・沢・渓流から離れる', '指定避難場所へ浸水路を避けて移動', '自治体の緊急情報に即座に従う']
        : ['【要配慮者避難開始】山際・渓流沿いを離れる', '避難場所・経路を家族で再確認', '地鳴り・湧き水の変化に注意'],
      links: [
        { label: '気象庁 土砂災害警戒情報', url: 'https://www.jma.go.jp/bosai/mesh_warning/' },
        { label: '国土交通省 砂防情報', url: 'https://www.mlit.go.jp/mizukokudo/sabo/' },
        { label: '国土地理院 土砂崩れ危険箇所', url: 'https://disaportal.gsi.go.jp/' },
      ],
    });
  }

  // ── 洪水 ─────────────────────────────────────
  const floods = events.filter((e) => e.type === 'flood');
  if (floods.length > 0) {
    const areas  = [...new Set(floods.flatMap((e) => e.area ?? []))].slice(0, 4).join('・') || '複数地域';
    const level  = maxSev(floods);
    cards.push({
      id: 'flood', icon: '💧', title: '洪水・浸水情報', level,
      statusLines: [`洪水警報 ${floods.length}件 ／ ${areas}`],
      bodyLines: [
        `${areas}で洪水警報が発令中。河川の急激な増水・氾濫の恐れがあります。`,
        '河川沿い・低地・地下施設にいる方は高い場所へ移動してください。',
        '車で移動中の方は道路冠水箇所への進入は絶対に避けてください。',
      ],
      actions: ['河川・低地から離れ高い場所へ移動', '地下施設・半地下・車道冠水路を避ける', '自治体の避難情報を確認'],
      links: [
        { label: '気象庁 洪水警報', url: 'https://www.jma.go.jp/bosai/warning/' },
        { label: '国土交通省 川の防災情報', url: 'https://www.river.go.jp/' },
        { label: '国土地理院 浸水想定区域', url: 'https://disaportal.gsi.go.jp/' },
      ],
    });
  }

  // ── 雨雲レーダー ─────────────────────────────
  if (layers.rain) {
    cards.push({
      id: 'rain', icon: '🌧', title: '雨雲レーダー（ナウキャスト）', level: 'info',
      statusLines: ['気象庁 降水ナウキャスト ／ 5分更新', 'リアルタイム降水強度（mm/h）を表示中'],
      bodyLines: [
        '気象庁の降水ナウキャストをリアルタイムで表示しています。',
        '色が濃いほど降水強度が強く、赤（30mm/h以上）・紫（50mm/h以上）のエリアでは急激な増水・冠水の恐れがあります。',
        'ナウキャストは5分先〜60分先の予測情報ではなく、現在の観測値です。予測には気象庁の降水短時間予報をご参照ください。',
        '1時間100mmを超える猛烈な雨（紫）の地域では、線状降水帯の発生に繋がる可能性があります。',
      ],
      actions: ['赤・紫エリア付近では屋外移動を中止', '川・用水路・側溝の急激な増水に注意', 'アンダーパス・地下街への進入を避ける'],
      links: [
        { label: '気象庁 雨雲ナウキャスト', url: 'https://www.jma.go.jp/bosai/nowc/' },
        { label: '気象庁 降水短時間予報', url: 'https://www.jma.go.jp/bosai/map.html#5/34/137/&elem=prep' },
        { label: '気象庁 大雨警報', url: 'https://www.jma.go.jp/bosai/warning/' },
      ],
    });
  }

  // ── 雷ナウキャスト ────────────────────────────
  if (layers.thunder) {
    cards.push({
      id: 'thunder', icon: '⚡', title: '雷ナウキャスト', level: 'advisory',
      statusLines: ['気象庁 雷ナウキャスト ／ 1時間予測', '雷活動度レベル1〜4を表示中'],
      bodyLines: [
        '気象庁の雷ナウキャストを表示しています。現在の落雷分布と1時間先の予測を確認できます。',
        'レベル1（黄）: 雷あり、レベル2（橙）: 活発、レベル3（赤）: 非常に活発、レベル4（暗赤）: 激しい落雷。',
        'レベル2以上のエリアでは屋外活動を即座に中断し、丈夫な建物または車内に退避してください。',
        '落雷は突発的に発生します。雷鳴が聞こえたらすぐに屋内へ避難してください。',
      ],
      actions: ['雷鳴・稲妻が見えたら直ちに屋内・車内へ', '高い木・電柱・鉄塔から離れる', '傘・ゴルフクラブ・釣り竿は持たない'],
      links: [
        { label: '気象庁 雷ナウキャスト', url: 'https://www.jma.go.jp/bosai/nowc/' },
        { label: '気象庁 雷注意報', url: 'https://www.jma.go.jp/bosai/warning/' },
      ],
    });
  }

  // ── ハザードマップ ────────────────────────────
  if (layers.hazard) {
    cards.push({
      id: 'hazard', icon: '🗺️', title: '洪水浸水想定区域（ハザードマップ）', level: 'info',
      statusLines: ['国土交通省 洪水浸水想定区域図 ／ 想定最大規模', '色が濃いほど浸水深リスクが高い'],
      bodyLines: [
        '国土交通省が公開する洪水浸水想定区域（想定最大規模）を表示しています。',
        '浅黄〜茶系の色は浸水深を示します: 浅黄（0.5m未満）→ 橙（1〜2m）→ 赤（3〜5m）→ 暗紫（10m以上）。',
        '浸水深 0.5〜1m で歩行困難、1m 以上で車が浮く、2m 以上で1階が完全水没、5m 以上で2階も浸水します。',
        'これは平常時の事前確認用マップです。実際の災害時は気象庁・自治体の情報を最優先にしてください。',
        '国土地理院の「重ねるハザードマップ」で自宅・職場の詳細なリスクを確認できます。',
      ],
      actions: ['自宅・職場の浸水リスクを確認', '浸水深2m超エリアは2階への垂直避難も検討', '避難場所・経路を事前に把握', '家族の緊急連絡先・集合場所を決めておく'],
      links: [
        { label: '国土地理院 重ねるハザードマップ', url: 'https://disaportal.gsi.go.jp/' },
        { label: '国土交通省 ハザードマップポータル', url: 'https://disapotal.gsi.go.jp/' },
        { label: '気象庁 大雨・洪水情報', url: 'https://www.jma.go.jp/bosai/warning/' },
      ],
    });
  }

  // ── 土砂危険箇所レイヤー ──────────────────────
  if (layers.landslide) {
    cards.push({
      id: 'landslideLayer', icon: '🏔️', title: '急傾斜地崩壊危険箇所', level: 'info',
      statusLines: ['国土地理院 土砂災害警戒区域 ／ 参照情報', 'レッドゾーン（特別警戒）・イエローゾーン（警戒）'],
      bodyLines: [
        '土砂災害防止法に基づく「土砂災害警戒区域（イエローゾーン）」と「土砂災害特別警戒区域（レッドゾーン）」を表示しています。',
        'レッドゾーン: 土砂災害が生命・身体に著しい危害を与えるおそれがある区域。住宅の新築には厳しい制限があります。',
        'イエローゾーン: 土砂災害が生命・身体に危害を与えるおそれがある区域。避難計画の策定が求められます。',
        'これらの区域に居住・滞在している場合は、土砂災害警戒情報が発令された際は直ちに避難してください。',
      ],
      actions: ['自宅・通勤路の警戒区域指定を確認', '警戒情報発令時はレッドゾーンから直ちに避難', '異音・亀裂・湧き水の変化に日頃から注意'],
      links: [
        { label: '国土地理院 土砂崩れ危険箇所', url: 'https://disaportal.gsi.go.jp/' },
        { label: '国土交通省 砂防情報', url: 'https://www.mlit.go.jp/mizukokudo/sabo/' },
        { label: '気象庁 土砂災害警戒情報', url: 'https://www.jma.go.jp/bosai/mesh_warning/' },
      ],
    });
  }

  // ── 情報なし ─────────────────────────────────
  if (cards.length === 0) {
    cards.push({
      id: 'none', icon: '✅', title: '重大な災害情報なし', level: 'info',
      statusLines: ['現在、重大な気象・地震・津波情報は発令されていません'],
      bodyLines: [
        '現時点で重大な災害情報は確認されていません。ただし、気象・地震は突発的に発生することがあります。',
        '日頃から非常持ち出し品・避難場所・家族との連絡手段を確認しておくことが重要です。',
        '気象庁や自治体のSNS・防災アプリへの登録もお勧めします。',
      ],
      actions: ['非常持ち出し品を定期点検する', '避難場所・経路を家族で確認する', '気象庁・自治体の防災情報を登録する', '家族の緊急連絡先を共有しておく'],
      links: [
        { label: '気象庁 防災情報ポータル', url: 'https://www.jma.go.jp/bosai/' },
        { label: '内閣府 防災情報', url: 'https://www.bousai.go.jp/' },
        { label: 'Yahoo! 防災速報', url: 'https://emg.yahoo.co.jp/' },
        { label: 'NHK 防災・気象', url: 'https://www3.nhk.or.jp/sokuho/' },
      ],
    });
  }

  return cards;
}

// ────────────────────────────────────────────────
// UI: カードコンポーネント
// ────────────────────────────────────────────────
function CardItem({ card }: { card: NewsCard }) {
  const [expanded, setExpanded] = useState(false);
  const color = LEVEL_COLOR[card.level];
  const label = LEVEL_LABEL[card.level];

  return (
    <div style={{ border: `1px solid ${color}44`, borderLeft: `3px solid ${color}`, marginBottom: 8, background: 'rgba(6,8,18,0.95)' }}>
      {/* ヘッダー（タップで開閉） */}
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', padding: '9px 12px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 15, flexShrink: 0 }}>{card.icon}</span>
          <span style={{ color, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', flex: 1 }}>{card.title}</span>
          <span style={{ background: `${color}22`, border: `1px solid ${color}`, color, fontSize: 7, padding: '1px 6px', letterSpacing: '0.1em', flexShrink: 0 }}>
            {label}
          </span>
          <span style={{ color: 'var(--cp-muted)', fontSize: 9, flexShrink: 0, marginLeft: 4 }}>{expanded ? '▲' : '▼'}</span>
        </div>
        <div style={{ marginTop: 4, paddingLeft: 23 }}>
          {card.statusLines.map((s, i) => (
            <div key={i} style={{ color: i === 0 ? 'var(--cp-text)' : 'var(--cp-muted)', fontSize: 9, letterSpacing: '0.03em', lineHeight: 1.5 }}>
              {s}
            </div>
          ))}
        </div>
      </button>

      {/* 展開コンテンツ */}
      {expanded && (
        <div style={{ padding: '0 12px 10px 12px', borderTop: `1px solid ${color}33` }}>
          {/* 説明文 */}
          <div style={{ paddingTop: 8, marginBottom: 8 }}>
            {card.bodyLines.map((line, i) => (
              <p key={i} style={{ color: 'var(--cp-muted)', fontSize: 10, lineHeight: 1.7, margin: '0 0 4px' }}>{line}</p>
            ))}
          </div>

          {/* アクション */}
          {card.actions.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ color: color, fontSize: 8, letterSpacing: '0.12em', marginBottom: 5 }}>▶ 推奨アクション</div>
              {card.actions.map((a, i) => (
                <div key={i} style={{ color: 'var(--cp-text)', fontSize: 9, lineHeight: 1.6, padding: '2px 0', display: 'flex', gap: 6 }}>
                  <span style={{ color, flexShrink: 0 }}>›</span>
                  <span>{a}</span>
                </div>
              ))}
            </div>
          )}

          {/* リンク */}
          <div>
            <div style={{ color: 'var(--cp-muted)', fontSize: 8, letterSpacing: '0.1em', marginBottom: 5 }}>▶ 公式情報・外部リンク</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {card.links.map((link) => (
                <a
                  key={link.url}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: 'var(--cp-cyan)',
                    fontSize: 9,
                    letterSpacing: '0.04em',
                    padding: '3px 8px',
                    border: '1px solid rgba(0,229,255,0.3)',
                    background: 'rgba(0,229,255,0.06)',
                    textDecoration: 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {link.label} ↗
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────
// 外部ニュースフィード
// ────────────────────────────────────────────────
function ExternalNewsFeed() {
  const [items, setItems]     = useState<ExternalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    fetch('/api/news')
      .then((r) => r.json())
      .then((d) => { if (!cancelled) { setItems(d.items ?? []); setLoading(false); } })
      .catch(() => { if (!cancelled) { setError(true); setLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div style={{ padding: '12px 0', color: 'var(--cp-muted)', fontSize: 9, letterSpacing: '0.1em', textAlign: 'center' }}>
        ニュースを取得中...
      </div>
    );
  }
  if (error || items.length === 0) {
    return (
      <div style={{ padding: '12px 0', color: 'var(--cp-muted)', fontSize: 9, textAlign: 'center' }}>
        外部ニュースを取得できませんでした。
        <a href="https://www3.nhk.or.jp/news/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--cp-cyan)', marginLeft: 6 }}>
          NHK NEWS ↗
        </a>
      </div>
    );
  }

  function fmtPubDate(dateStr: string) {
    try {
      const d = new Date(dateStr);
      return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
    } catch { return dateStr; }
  }

  return (
    <div>
      {items.map((item, i) => (
        <div key={i} style={{ borderBottom: '1px solid var(--cp-border)', padding: '8px 0' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 3 }}>
            <span style={{ color: 'var(--cp-muted)', fontSize: 7, letterSpacing: '0.08em', whiteSpace: 'nowrap', flexShrink: 0, marginTop: 2 }}>
              {item.source}
            </span>
            <span style={{ color: 'var(--cp-muted)', fontSize: 7, whiteSpace: 'nowrap', flexShrink: 0, marginTop: 2 }}>
              {fmtPubDate(item.pubDate)}
            </span>
          </div>
          <a
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--cp-text)', fontSize: 10, letterSpacing: '0.03em', lineHeight: 1.5, textDecoration: 'none', display: 'block', marginBottom: 3 }}
          >
            {item.title} ↗
          </a>
          {item.description && (
            <p style={{ color: 'var(--cp-muted)', fontSize: 9, lineHeight: 1.6, margin: 0 }}>
              {item.description.slice(0, 120)}{item.description.length > 120 ? '…' : ''}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

// ────────────────────────────────────────────────
// メインモーダル
// ────────────────────────────────────────────────
export function NewsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const events            = useDisasterStore((s) => s.events);
  const typhoons          = useDisasterStore((s) => s.typhoons);
  const linearPrecipBands = useDisasterStore((s) => s.linearPrecipBands);
  const landslideWarnings = useDisasterStore((s) => s.landslideWarnings);
  const layers            = useDisasterStore((s) => s.layers);
  const [tab, setTab]     = useState<'disaster' | 'news'>('disaster');

  const cards = useMemo(
    () => buildCards(events, typhoons, linearPrecipBands, landslideWarnings, layers),
    [events, typhoons, linearPrecipBands, landslideWarnings, layers],
  );

  if (!open) return null;

  const emergencyCount = cards.filter((c) => c.level === 'emergency').length;

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 100, backdropFilter: 'blur(3px)' }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 101,
        maxHeight: '85svh', display: 'flex', flexDirection: 'column',
        background: 'rgba(4,6,14,0.98)',
        border: '1px solid var(--cp-cyan)', borderBottom: 'none',
        fontFamily: 'var(--font-geist-mono, monospace)',
      }}>
        {/* モーダルヘッダー */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderBottom: '1px solid var(--cp-border)', flexShrink: 0 }}>
          <span style={{ color: 'var(--cp-cyan)', fontSize: 9, letterSpacing: '0.2em' }}>◈ 統合ニュース</span>
          {emergencyCount > 0 && (
            <span style={{ background: '#ff174422', border: '1px solid #ff1744', color: '#ff1744', fontSize: 7, padding: '1px 5px', letterSpacing: '0.1em' }}>
              緊急 {emergencyCount}
            </span>
          )}
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--cp-border)', color: 'var(--cp-muted)', fontSize: 10, width: 24, height: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            ✕
          </button>
        </div>

        {/* タブ */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--cp-border)', flexShrink: 0 }}>
          {(['disaster', 'news'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1, padding: '7px 0', background: tab === t ? 'rgba(0,229,255,0.08)' : 'transparent',
                border: 'none', borderBottom: tab === t ? '2px solid var(--cp-cyan)' : '2px solid transparent',
                color: tab === t ? 'var(--cp-cyan)' : 'var(--cp-muted)',
                fontSize: 9, letterSpacing: '0.14em', cursor: 'pointer',
                fontFamily: 'var(--font-geist-mono, monospace)',
              }}
            >
              {t === 'disaster' ? `◈ 災害・気象情報 (${cards.length})` : '📰 最新ニュース'}
            </button>
          ))}
        </div>

        {/* コンテンツ */}
        <div style={{ overflowY: 'auto', padding: '10px 12px', flex: 1 }}>
          {tab === 'disaster' && (
            <>
              {cards.map((card) => <CardItem key={card.id} card={card} />)}
              <div style={{ paddingTop: 8, color: 'var(--cp-muted)', fontSize: 7, letterSpacing: '0.05em', textAlign: 'center' }}>
                出典: 気象庁 / 国土地理院 / 国土交通省 / P2P地震情報 ／ 本情報は参考値です。公式発表を最優先にしてください。
              </div>
            </>
          )}
          {tab === 'news' && (
            <>
              <div style={{ color: 'var(--cp-muted)', fontSize: 8, letterSpacing: '0.08em', marginBottom: 10 }}>
                NHK NEWS (防災・気象カテゴリ) より自動取得 ／ 5分キャッシュ
              </div>
              <ExternalNewsFeed />
            </>
          )}
        </div>
      </div>
    </>
  );
}
