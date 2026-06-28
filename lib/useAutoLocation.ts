'use client';

import { useEffect } from 'react';
import { useDisasterStore } from '@/store/useDisasterStore';
import { latLngToPrefCode } from '@/lib/geo';

/**
 * アプリ起動時に一度だけ位置情報を取得し、store に保存する。
 * - 許可済みなら即座に取得
 * - 未許可なら permission prompt を表示
 * - 拒否済みなら何もしない
 */
export function useAutoLocation() {
  const setUserLocation  = useDisasterStore((s) => s.setUserLocation);
  const setForecastArea  = useDisasterStore((s) => s.setForecastArea);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;

    // すでに取得済みなら再取得しない
    if (useDisasterStore.getState().userLocation) return;

    const opts: PositionOptions = { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 };

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, accuracy } = pos.coords;
        setUserLocation({ lat, lng, accuracy });
        // 天気予報エリアも自動切替
        setForecastArea(latLngToPrefCode(lat, lng));
      },
      () => { /* 拒否・エラーは無視 */ },
      opts,
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
