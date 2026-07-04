import * as Location from 'expo-location';
import { Coordinates } from '../types/shared-types';

const BEST_LOCATION_SAMPLE_MS = 3500;
const MIN_LOCATION_SAMPLES = 3;
const GOOD_ACCURACY_METERS = 25;

function accuracyOf(location: Location.LocationObject): number {
  return location.coords.accuracy ?? Number.POSITIVE_INFINITY;
}

function toCoordinates(location: Location.LocationObject): Coordinates {
  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
  };
}

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
      const location = await this.getBestInitialLocation();
      return toCoordinates(location);
    } catch (error) {
      console.error('[LocationService] Get location failed:', error);
      throw new Error('Konum alınamadı');
    }
  }

  private async getBestInitialLocation(): Promise<Location.LocationObject> {
    try {
      return await this.sampleBestLocation();
    } catch {
      return Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
    }
  }

  private sampleBestLocation(): Promise<Location.LocationObject> {
    return new Promise((resolve, reject) => {
      const samples: Location.LocationObject[] = [];
      let settled = false;
      let subscription: Location.LocationSubscription | null = null;
      let removeWhenReady = false;

      const cleanup = () => {
        if (subscription) {
          subscription.remove();
        } else {
          removeWhenReady = true;
        }
      };

      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        cleanup();

        const best = samples.sort((a, b) => accuracyOf(a) - accuracyOf(b))[0];
        if (best) {
          resolve(best);
        } else {
          reject(new Error('Konum örneği alınamadı'));
        }
      };

      const timeoutId = setTimeout(finish, BEST_LOCATION_SAMPLE_MS);

      Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 500,
          distanceInterval: 0,
        },
        (location) => {
          samples.push(location);
          const bestAccuracy = Math.min(...samples.map(accuracyOf));
          if (samples.length >= MIN_LOCATION_SAMPLES && bestAccuracy <= GOOD_ACCURACY_METERS) {
            finish();
          }
        }
      )
        .then((sub) => {
          subscription = sub;
          if (removeWhenReady) {
            subscription.remove();
          }
        })
        .catch((error) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeoutId);
          reject(error);
        });
    });
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
