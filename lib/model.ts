export type DisasterEventType =
  | 'earthquake'
  | 'tsunami'
  | 'volcano'
  | 'flood'
  | 'rain'
  | 'shelter'
  | 'thunder'
  | 'typhoon'
  | 'linear_precip'
  | 'landslide';

export type Severity = 'info' | 'advisory' | 'warning' | 'emergency';

export type DisasterEvent = {
  id: string;
  type: DisasterEventType;
  severity: Severity;
  title: string;
  occurredAt: string; // ISO8601
  location?: { lat: number; lng: number };
  area?: string[];
  raw: unknown;
  source: string;
};

// 台風カテゴリ（RSMC/WMO 分類）
export type TyphoonClassType = 'TY' | 'STS' | 'TS' | 'TD' | 'ET' | 'unknown';

// 台風トラック点（過去実況 or 予報）
export type TyphoonTrackPoint = {
  lat: number;
  lng: number;
  time: string;
  classType: TyphoonClassType;
  pressureHPa?: number;
  maxWindKt?: number;
  forecast: boolean;
};

// 台風情報
export type TyphoonInfo = {
  id: string;
  name: string;
  nameEn: string;
  lat: number;
  lng: number;
  pressureHPa: number;
  maxWindMs: number;
  maxWindKt: number;
  category: TyphoonClassType;
  track: Array<{
    lat: number;
    lng: number;
    time: string;
    forecast: boolean;
  }>;
  // 過去トラック履歴（Best Track または海上警報XMLから）
  history: TyphoonTrackPoint[];
};

// 線状降水帯
export type LinearPrecipBand = {
  id: string;
  area: string;
  startedAt: string;
};

// 週間天気予報
export type ForecastDay = {
  date: string;        // YYYY-MM-DD
  weather: string;     // "晴れ" etc.
  weatherCode: string; // JMA code
  popMax: number;      // 最大降水確率 0-100
  tempMax?: number;
  tempMin?: number;
  reliability?: string; // 週間予報の信頼度 A/B/C（Aが最も確度高）
  wind?: string;        // 風の予報（3日予報のみ）
  pops6h?: { label: string; pop: number }[]; // 時間帯別降水確率（今日・明日のみ）
};

// 降水・雷ナウキャストのタイルフレーム（タイムライン用）
export type TileFrame = {
  basetime: string;   // YYYYMMDDHHMMSS
  validtime: string;  // YYYYMMDDHHMMSS
  kind?: 'nowc' | 'rasrf';
};

// 緊急地震速報（EEW）
export type EewData = {
  id: string;
  serial: number;
  issuedAt: string;   // ISO8601
  quakeTime: string;  // 推定発生時刻 ISO8601
  epicenterName: string;
  lat: number;
  lng: number;
  depth: number;      // km
  magnitude: number;
  maxScale: number;   // JMA震度コード: 10=1, 20=2, 30=3, 40=4, 45=4強, 50=5弱…70=7
  isFinal: boolean;
  isWarning: boolean; // code:555=警報 / code:554=予報
};

// 土砂災害警戒情報
export type LandslideWarning = {
  id: string;
  prefecture: string;
  area: string;
  level: 'warning' | 'emergency';
  issuedAt: string;
};
