import { useState, useEffect } from 'react';
import { Coordinates, NearestStopResult } from '../types/shared-types';
import stopService from '../services/stops/StopService';

interface UseNearestStopReturn {
  nearestStop: NearestStopResult | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * useNearestStop Hook
 * Kullanıcı konumuna göre en yakın durağı bulur (yerel hesaplama)
 */
export const useNearestStop = (
  userLocation: Coordinates | null,
  line?: string
): UseNearestStopReturn => {
  const [nearestStop, setNearestStop] = useState<NearestStopResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userLocation) {
      setNearestStop(null);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Yerel hesaplama - backend'e gerek yok
      const result = stopService.findNearestStop(userLocation, line);
      setNearestStop(result);
    } catch (err: any) {
      setError(err.message || 'En yakın durak bulunamadı');
    } finally {
      setIsLoading(false);
    }
  }, [userLocation?.latitude, userLocation?.longitude, line]);

  return {
    nearestStop,
    isLoading,
    error,
  };
};
