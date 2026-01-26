import { useState, useEffect, useMemo } from 'react';
import { BusStop } from '../types/shared-types';
import stopService from '../services/stops/StopService';

interface UseStopsReturn {
  stops: BusStop[];
  isLoading: boolean;
  error: string | null;
  getStopsByLine: (line: string) => BusStop[];
  getAllLines: () => string[];
}

/**
 * useStops Hook
 * Yerel JSON'dan durakları yükler (backend'e gerek yok)
 */
export const useStops = (): UseStopsReturn => {
  const [stops, setStops] = useState<BusStop[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      // Yerel veriden durakları al
      const allStops = stopService.getAllStops();
      setStops(allStops);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Duraklar yüklenemedi');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Hatta göre durakları filtrele
  const getStopsByLine = useMemo(() => {
    return (line: string): BusStop[] => {
      return stopService.getStopsByLine(line);
    };
  }, []);

  // Tüm hatları getir
  const getAllLines = useMemo(() => {
    return (): string[] => {
      return stopService.getAllLines();
    };
  }, []);

  return {
    stops,
    isLoading,
    error,
    getStopsByLine,
    getAllLines,
  };
};
