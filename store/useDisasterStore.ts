'use client';

import { create } from 'zustand';
import type {
  DisasterEvent,
  TyphoonInfo,
  LinearPrecipBand,
  LandslideWarning,
  ForecastDay,
  EewData,
} from '@/lib/model';

export type LayerKey =
  | 'earthquake'
  | 'hazard'
  | 'rain'
  | 'thunder'
  | 'typhoon'
  | 'linearPrecip'
  | 'landslide'
  | 'tsunami';

type Layers = Record<LayerKey, boolean>;

type DisasterStore = {
  events: DisasterEvent[];
  selectedEvent: DisasterEvent | null;
  layers: Layers;

  // タイムライン（null = ライブ現在）
  selectedTime: number | null;

  // 降水・雷ナウキャスト
  rainTileTime: string | null;
  thunderTileTime: string | null;
  rainTileHistory: string[];  // 利用可能な過去タイル validtime 一覧

  // 気象データ
  typhoons: TyphoonInfo[];
  linearPrecipBands: LinearPrecipBand[];
  landslideWarnings: LandslideWarning[];

  // 週間天気予報
  forecastDays: ForecastDay[];
  forecastArea: string; // JMA エリアコード

  // 現在地
  userLocation: { lat: number; lng: number; accuracy: number } | null;

  // EEW（緊急地震速報）
  eewAlert: EewData | null;

  // 表示モード
  simpleMode: boolean;

  // アクション
  setEvents: (events: DisasterEvent[]) => void;
  addEvents: (events: DisasterEvent[]) => void;
  selectEvent: (event: DisasterEvent | null) => void;
  toggleLayer: (key: LayerKey) => void;
  enableLayer: (key: LayerKey) => void;
  setSelectedTime: (t: number | null) => void;
  setRainTileTime: (t: string) => void;
  setThunderTileTime: (t: string) => void;
  setRainTileHistory: (times: string[]) => void;
  setTyphoons: (typhoons: TyphoonInfo[]) => void;
  setLinearPrecipBands: (bands: LinearPrecipBand[]) => void;
  setLandslideWarnings: (warnings: LandslideWarning[]) => void;
  setForecastDays: (days: ForecastDay[]) => void;
  setForecastArea: (area: string) => void;
  setUserLocation: (loc: { lat: number; lng: number; accuracy: number } | null) => void;
  setEewAlert: (eew: EewData | null) => void;
  setSimpleMode: (v: boolean) => void;
};

export const useDisasterStore = create<DisasterStore>((set) => ({
  events: [],
  selectedEvent: null,
  layers: {
    earthquake:  true,
    hazard:      false,
    rain:        false,
    thunder:     false,
    typhoon:     true,
    linearPrecip:true,
    landslide:   false,
    tsunami:     true,
  },
  selectedTime: null,
  rainTileTime: null,
  thunderTileTime: null,
  rainTileHistory: [],
  typhoons: [],
  linearPrecipBands: [],
  landslideWarnings: [],
  forecastDays: [],
  forecastArea: '130000',
  userLocation: null,
  eewAlert: null,
  simpleMode: false,

  setEvents: (events) => set({ events }),
  addEvents: (incoming) =>
    set((state) => {
      const existingIds = new Set(state.events.map((e) => e.id));
      const newEvents = incoming.filter((e) => !existingIds.has(e.id));
      if (newEvents.length === 0) return state;
      return { events: [...newEvents, ...state.events].slice(0, 200) };
    }),
  selectEvent: (selectedEvent) => set({ selectedEvent }),
  toggleLayer: (key) =>
    set((state) => ({ layers: { ...state.layers, [key]: !state.layers[key] } })),
  enableLayer: (key) =>
    set((state) => ({ layers: { ...state.layers, [key]: true } })),
  setSelectedTime: (selectedTime) => set({ selectedTime }),
  setRainTileTime: (rainTileTime) => set({ rainTileTime }),
  setThunderTileTime: (thunderTileTime) => set({ thunderTileTime }),
  setRainTileHistory: (rainTileHistory) => set({ rainTileHistory }),
  setTyphoons: (typhoons) => set({ typhoons }),
  setLinearPrecipBands: (linearPrecipBands) => set({ linearPrecipBands }),
  setLandslideWarnings: (landslideWarnings) => set({ landslideWarnings }),
  setForecastDays: (forecastDays) => set({ forecastDays }),
  setForecastArea: (forecastArea) => set({ forecastArea }),
  setUserLocation: (userLocation) => set({ userLocation }),
  setEewAlert: (eewAlert) => set({ eewAlert }),
  setSimpleMode: (simpleMode) => set({ simpleMode }),
}));
