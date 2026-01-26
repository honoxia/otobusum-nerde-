import { useState, useEffect } from 'react';
import { Coordinates } from '../types/shared-types';
import LocationService from '../services/LocationService';

// Eskişehir merkezi - Emülatör için fallback konum
const DEFAULT_LOCATION: Coordinates = {
  latitude: 39.7767,
  longitude: 30.5206,
};

interface UseLocationReturn {
  location: Coordinates | null;
  error: string | null;
  isLoading: boolean;
  refreshLocation: () => Promise<void>;
}

/**
 * useLocation Hook
 * Kullanıcı konumunu yönetir
 */
export const useLocation = (): UseLocationReturn => {
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchLocation = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const granted = await LocationService.requestPermission();
      if (!granted) {
        // İzin verilmedi - varsayılan konumu kullan
        console.log('[useLocation] İzin verilmedi, varsayılan konum kullanılıyor');
        setLocation(DEFAULT_LOCATION);
        setError('Konum izni verilmedi (varsayılan konum kullanılıyor)');
        setIsLoading(false);
        return;
      }

      const coords = await LocationService.getCurrentLocation();
      setLocation(coords);
    } catch (err: any) {
      // Konum alınamadı - varsayılan konumu kullan (emülatör desteği)
      console.log('[useLocation] Konum alınamadı, varsayılan konum kullanılıyor:', err.message);
      setLocation(DEFAULT_LOCATION);
      setError('Konum alınamadı (varsayılan konum kullanılıyor)');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLocation();
  }, []);

  return {
    location,
    error,
    isLoading,
    refreshLocation: fetchLocation,
  };
};
