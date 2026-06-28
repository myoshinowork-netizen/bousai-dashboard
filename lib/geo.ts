// 共通地理ユーティリティ

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// JMA エリアコード → { 表示名, 検索キーワード[], 中心座標 }
export const PREF_GEO: {
  code: string;
  label: string;
  keywords: string[];
  lat: number;
  lng: number;
}[] = [
  { code: '016000', label: '北海道(札幌)', keywords: ['北海道', '札幌'], lat: 43.06, lng: 141.35 },
  { code: '011000', label: '北海道(宗谷)', keywords: ['北海道', '宗谷'], lat: 45.40, lng: 141.67 },
  { code: '012000', label: '北海道(上川)', keywords: ['北海道', '上川'], lat: 43.77, lng: 142.36 },
  { code: '013000', label: '北海道(網走)', keywords: ['北海道', '網走'], lat: 43.91, lng: 144.27 },
  { code: '014030', label: '北海道(十勝)', keywords: ['北海道', '十勝'], lat: 42.92, lng: 143.20 },
  { code: '014100', label: '北海道(釧路)', keywords: ['北海道', '釧路'], lat: 43.00, lng: 144.38 },
  { code: '015000', label: '北海道(胆振)', keywords: ['北海道', '胆振'], lat: 42.61, lng: 141.60 },
  { code: '017000', label: '北海道(渡島)', keywords: ['北海道', '渡島', '函館'], lat: 41.77, lng: 140.73 },
  { code: '020000', label: '青森', keywords: ['青森', '青森県'], lat: 40.82, lng: 140.74 },
  { code: '030000', label: '岩手', keywords: ['岩手', '岩手県', '盛岡'], lat: 39.70, lng: 141.15 },
  { code: '040000', label: '宮城', keywords: ['宮城', '宮城県', '仙台'], lat: 38.27, lng: 140.87 },
  { code: '050000', label: '秋田', keywords: ['秋田', '秋田県'], lat: 39.72, lng: 140.10 },
  { code: '060000', label: '山形', keywords: ['山形', '山形県'], lat: 38.24, lng: 140.36 },
  { code: '070000', label: '福島', keywords: ['福島', '福島県'], lat: 37.75, lng: 140.47 },
  { code: '080000', label: '茨城', keywords: ['茨城', '茨城県'], lat: 36.34, lng: 140.45 },
  { code: '090000', label: '栃木', keywords: ['栃木', '栃木県', '宇都宮'], lat: 36.57, lng: 139.88 },
  { code: '100000', label: '群馬', keywords: ['群馬', '群馬県'], lat: 36.39, lng: 139.06 },
  { code: '110000', label: '埼玉', keywords: ['埼玉', '埼玉県'], lat: 35.86, lng: 139.65 },
  { code: '120000', label: '千葉', keywords: ['千葉', '千葉県'], lat: 35.60, lng: 140.12 },
  { code: '130000', label: '東京', keywords: ['東京', '東京都', '東京地方'], lat: 35.69, lng: 139.69 },
  { code: '140000', label: '神奈川', keywords: ['神奈川', '神奈川県', '横浜'], lat: 35.45, lng: 139.64 },
  { code: '150000', label: '新潟', keywords: ['新潟', '新潟県'], lat: 37.90, lng: 139.02 },
  { code: '160000', label: '富山', keywords: ['富山', '富山県'], lat: 36.70, lng: 137.21 },
  { code: '170000', label: '石川', keywords: ['石川', '石川県', '金沢'], lat: 36.59, lng: 136.63 },
  { code: '180000', label: '福井', keywords: ['福井', '福井県'], lat: 36.07, lng: 136.22 },
  { code: '190000', label: '山梨', keywords: ['山梨', '山梨県'], lat: 35.66, lng: 138.57 },
  { code: '200000', label: '長野', keywords: ['長野', '長野県'], lat: 36.65, lng: 138.18 },
  { code: '210000', label: '岐阜', keywords: ['岐阜', '岐阜県'], lat: 35.39, lng: 136.72 },
  { code: '220000', label: '静岡', keywords: ['静岡', '静岡県'], lat: 34.98, lng: 138.38 },
  { code: '230000', label: '愛知', keywords: ['愛知', '愛知県', '名古屋'], lat: 35.18, lng: 136.91 },
  { code: '240000', label: '三重', keywords: ['三重', '三重県'], lat: 34.73, lng: 136.51 },
  { code: '250000', label: '滋賀', keywords: ['滋賀', '滋賀県'], lat: 35.00, lng: 135.87 },
  { code: '260000', label: '京都', keywords: ['京都', '京都府'], lat: 35.02, lng: 135.76 },
  { code: '270000', label: '大阪', keywords: ['大阪', '大阪府', '大阪市'], lat: 34.69, lng: 135.50 },
  { code: '280000', label: '兵庫', keywords: ['兵庫', '兵庫県', '神戸'], lat: 34.69, lng: 135.18 },
  { code: '290000', label: '奈良', keywords: ['奈良', '奈良県'], lat: 34.68, lng: 135.83 },
  { code: '300000', label: '和歌山', keywords: ['和歌山', '和歌山県'], lat: 34.23, lng: 135.17 },
  { code: '310000', label: '鳥取', keywords: ['鳥取', '鳥取県'], lat: 35.50, lng: 134.24 },
  { code: '320000', label: '島根', keywords: ['島根', '島根県'], lat: 35.47, lng: 133.05 },
  { code: '330000', label: '岡山', keywords: ['岡山', '岡山県'], lat: 34.66, lng: 133.93 },
  { code: '340000', label: '広島', keywords: ['広島', '広島県'], lat: 34.40, lng: 132.46 },
  { code: '350000', label: '山口', keywords: ['山口', '山口県'], lat: 34.19, lng: 131.47 },
  { code: '360000', label: '徳島', keywords: ['徳島', '徳島県'], lat: 34.07, lng: 134.56 },
  { code: '370000', label: '香川', keywords: ['香川', '香川県'], lat: 34.34, lng: 134.04 },
  { code: '380000', label: '愛媛', keywords: ['愛媛', '愛媛県'], lat: 33.84, lng: 132.77 },
  { code: '390000', label: '高知', keywords: ['高知', '高知県'], lat: 33.56, lng: 133.53 },
  { code: '400000', label: '福岡', keywords: ['福岡', '福岡県', '福岡市'], lat: 33.61, lng: 130.42 },
  { code: '410000', label: '佐賀', keywords: ['佐賀', '佐賀県'], lat: 33.25, lng: 130.30 },
  { code: '420000', label: '長崎', keywords: ['長崎', '長崎県'], lat: 32.74, lng: 129.87 },
  { code: '430000', label: '熊本', keywords: ['熊本', '熊本県'], lat: 32.79, lng: 130.74 },
  { code: '440000', label: '大分', keywords: ['大分', '大分県'], lat: 33.24, lng: 131.61 },
  { code: '450000', label: '宮崎', keywords: ['宮崎', '宮崎県'], lat: 31.91, lng: 131.42 },
  { code: '460040', label: '鹿児島', keywords: ['鹿児島', '鹿児島県'], lat: 31.56, lng: 130.56 },
  { code: '471000', label: '沖縄本島', keywords: ['沖縄', '沖縄県', '那覇'], lat: 26.21, lng: 127.68 },
  { code: '472000', label: '沖縄(大東)', keywords: ['沖縄', '大東島'], lat: 25.83, lng: 131.23 },
  { code: '473000', label: '沖縄(宮古)', keywords: ['沖縄', '宮古島'], lat: 24.80, lng: 125.28 },
  { code: '474000', label: '沖縄(八重山)', keywords: ['沖縄', '八重山', '石垣'], lat: 24.34, lng: 124.16 },
];

/** 座標から最近傍の都道府県エントリを返す */
export function nearestPrefEntry(lat: number, lng: number) {
  let best = PREF_GEO[0];
  let bestDist = Infinity;
  for (const p of PREF_GEO) {
    const d = haversineKm(lat, lng, p.lat, p.lng);
    if (d < bestDist) { bestDist = d; best = p; }
  }
  return best;
}

/** 座標から JMA エリアコードを返す */
export function latLngToPrefCode(lat: number, lng: number): string {
  return nearestPrefEntry(lat, lng).code;
}

/** 座標から検索キーワード配列を返す */
export function latLngToKeywords(lat: number, lng: number): string[] {
  return nearestPrefEntry(lat, lng).keywords;
}
