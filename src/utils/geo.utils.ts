import { Coordinates } from '../types/shared-types';

/**
 * Haversine formülü ile iki koordinat arasındaki mesafeyi hesaplar
 * @param coord1 İlk koordinat
 * @param coord2 İkinci koordinat
 * @returns Mesafe (metre cinsinden)
 */
export function calculateHaversineDistance(
  coord1: Coordinates,
  coord2: Coordinates
): number {
  const R = 6371e3; // Dünya yarıçapı (metre)
  const φ1 = (coord1.latitude * Math.PI) / 180;
  const φ2 = (coord2.latitude * Math.PI) / 180;
  const Δφ = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
  const Δλ = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // metre
}

/**
 * Koordinatları string formatına çevirir (debug için)
 */
export function formatCoordinates(coords: Coordinates): string {
  return `(${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)})`;
}

/**
 * Mesafeyi okunabilir formata çevirir
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(2)} km`;
}
