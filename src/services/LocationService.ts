import * as Location from 'expo-location';
import { Coordinates } from '../types/shared-types';

/**
 * Location Service - Konum servisi wrapper
 * INPUT: Permission request, location query
 * OUTPUT: User coordinates
 */
class LocationService {
  /**
   * Konum izni iste
   */
  async requestPermission(): Promise<boolean> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('[LocationService] Permission request failed:', error);
      return false;
    }
  }

  /**
   * Mevcut konumu al
   */
  async getCurrentLocation(): Promise<Coordinates> {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
    } catch (error) {
      console.error('[LocationService] Get location failed:', error);
      throw new Error('Konum alınamadı');
    }
  }

  /**
   * Konumu sürekli izle (callback ile)
   */
  watchLocation(
    callback: (coords: Coordinates) => void,
    onError?: (error: Error) => void
  ): () => void {
    let subscription: Location.LocationSubscription | null = null;

    Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 10000, // 10 saniye
        distanceInterval: 10, // 10 metre
      },
      (location) => {
        callback({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      }
    )
      .then((sub) => {
        subscription = sub;
      })
      .catch((error) => {
        console.error('[LocationService] Watch location failed:', error);
        onError?.(new Error('Konum izleme başlatılamadı'));
      });

    // Cleanup function
    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }
}

// Singleton export
export default new LocationService();
