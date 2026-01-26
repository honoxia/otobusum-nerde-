import { BusStop, Coordinates, NearestStopResult } from '../../types/shared-types';
import { calculateHaversineDistance } from '../../utils/geo.utils';
import stopsData from '../../data/stops-data.json';

// App sabitleri
const MAX_NEARBY_STOP_DISTANCE = 1000; // metre

/**
 * Stop Service - Yerel durak verileri üzerinde işlem yapar
 */
class StopService {
  private stops: BusStop[] = [];

  constructor() {
    this.loadStops();
  }

  /**
   * Durak verilerini yükle
   */
  private loadStops(): void {
    try {
      this.stops = stopsData as BusStop[];
      console.log(`[StopService] ${this.stops.length} durak yüklendi`);
    } catch (error) {
      console.error('[StopService] Durak verileri yüklenemedi:', error);
      this.stops = [];
    }
  }

  /**
   * Tüm durakları getir
   */
  getAllStops(): BusStop[] {
    return this.stops;
  }

  /**
   * ID ile durak getir
   */
  getStopById(id: string): BusStop | undefined {
    return this.stops.find(stop => stop.id === id);
  }

  /**
   * Hat numarasına göre durakları getir
   * Varyantları da eşleştirir: "16" → "16M", "16S", "16K" hepsini bulur
   */
  getStopsByLine(line: string): BusStop[] {
    const query = line.toUpperCase().trim();

    return this.stops.filter(stop => {
      return stop.lines.some(stopLine => {
        const l = stopLine.toUpperCase();

        // Tam eşleşme
        if (l === query) return true;

        // Sorgu base hat ise (sadece sayı), varyantları da eşleştir
        if (/^\d+$/.test(query)) {
          // 16 → 16S, 16M, 16K eşleşir
          const regex = new RegExp(`^${query}[A-Z]`);
          return regex.test(l);
        }

        // Sorgu varyantlı ise, tam eşleşme veya alt varyant
        if (/^\d+[A-Z]$/.test(query)) {
          return l === query || l.startsWith(query + '-');
        }

        return false;
      });
    });
  }

  /**
   * Tüm benzersiz hatları getir
   */
  getAllLines(): string[] {
    const linesSet = new Set<string>();
    this.stops.forEach(stop => {
      stop.lines.forEach(line => linesSet.add(line));
    });
    return Array.from(linesSet).sort();
  }

  /**
   * En yakın durağı bul
   */
  findNearestStop(
    userLocation: Coordinates,
    line?: string,
    maxDistance: number = MAX_NEARBY_STOP_DISTANCE
  ): NearestStopResult {
    // Tüm durakları al (veya belirli hatta filtrele)
    let stops: BusStop[];
    if (line) {
      stops = this.getStopsByLine(line);
      if (stops.length === 0) {
        console.log(`[StopService] "${line}" hattı için durak bulunamadı`);
        return {
          stop: null,
          distance: Infinity,
          allNearbyStops: [],
        };
      }
    } else {
      stops = this.getAllStops();
    }

    // Her durak için mesafe hesapla
    const stopsWithDistance = stops
      .map(stop => ({
        stop,
        distance: calculateHaversineDistance(userLocation, stop.coordinates),
      }))
      .filter(item => item.distance <= maxDistance)
      .sort((a, b) => a.distance - b.distance);

    if (stopsWithDistance.length === 0) {
      console.log(
        `[StopService] ${maxDistance}m mesafe içinde durak bulunamadı`
      );
      return {
        stop: null,
        distance: Infinity,
        allNearbyStops: [],
      };
    }

    const nearest = stopsWithDistance[0];
    console.log(
      `[StopService] En yakın durak: ${nearest.stop.name} (${Math.round(nearest.distance)}m)`
    );

    return {
      stop: nearest.stop,
      distance: nearest.distance,
      allNearbyStops: stopsWithDistance,
    };
  }

  /**
   * Wialon ID ile durak getir
   */
  getStopByWialonId(wialonId: number): BusStop | undefined {
    return this.stops.find(stop => stop.wialonId === wialonId);
  }

  /**
   * Tüm durakların koordinat map'ini döndür (wialonId -> coordinates)
   * RouteService'in araç-durak mesafesi hesaplaması için kullanılır
   */
  getStopCoordinatesMap(): Map<number, Coordinates> {
    const map = new Map<number, Coordinates>();
    this.stops.forEach(stop => {
      if (stop.wialonId) {
        map.set(stop.wialonId, stop.coordinates);
      }
    });
    return map;
  }

  /**
   * Konum bazlı hat tahmini
   * Verilen konuma en yakın 3 durağı bulur ve ortak hatları kesiştirir
   * Backend'deki FlespiMqtt.ts'deki algoritmayı kullanır
   */
  estimateLineFromLocation(
    vehicleLocation: Coordinates,
    maxDistance: number = 500 // Araç durağa max 500m yakın olmalı
  ): string | null {
    // En yakın 3 durağı bul
    const stopsWithDistance = this.stops
      .map(stop => ({
        stop,
        distance: calculateHaversineDistance(vehicleLocation, stop.coordinates),
      }))
      .filter(item => item.distance <= maxDistance)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 3);

    if (stopsWithDistance.length === 0) {
      return null;
    }

    // Sadece 1 durak varsa, o durağın ilk hattını döndür
    if (stopsWithDistance.length === 1) {
      const lines = stopsWithDistance[0].stop.lines;
      return lines.length > 0 ? lines[0] : null;
    }

    // 2+ durak varsa, ortak hatları bul (kesişim)
    const lineSets = stopsWithDistance.map(
      item => new Set(item.stop.lines)
    );

    // İlk durağın hatlarından başla, diğerleriyle kesişim al
    let commonLines = [...lineSets[0]];
    for (let i = 1; i < lineSets.length; i++) {
      commonLines = commonLines.filter(line => lineSets[i].has(line));
    }

    // Ortak hat varsa döndür
    if (commonLines.length > 0) {
      return commonLines[0];
    }

    // Ortak hat yoksa, en yakın durağın ilk hattını döndür
    const nearestStopLines = stopsWithDistance[0].stop.lines;
    return nearestStopLines.length > 0 ? nearestStopLines[0] : null;
  }
}

// Singleton instance
const stopService = new StopService();
export default stopService;
