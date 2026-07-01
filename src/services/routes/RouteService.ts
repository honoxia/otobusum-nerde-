import { Coordinates } from '../../types/shared-types';
import { calculateHaversineDistance } from '../../utils/geo.utils';
import routesData from '../../data/routes-data.json';
import { devLog } from '../../utils/devLog';

interface RouteDirection {
  routeId: number;
  direction: string;
  stopIds: number[];
}

interface LineRoutes {
  line: string;
  routes: RouteDirection[];
}

interface DirectionResult {
  direction: string;
  routeId: number;
  confidence: 'high' | 'medium' | 'low';
}

export interface RouteDirectionOption {
  line: string;
  routeId: number;
  direction: string;
  label: string;
}

/**
 * Route Service - Hat yön bilgilerini yönetir
 *
 * Bir aracın hangi yönde gittiğini belirlemek için:
 * 1. Aracın konumuna en yakın durakları bul
 * 2. O durakların hangi route'larda olduğunu kontrol et
 * 3. Aracın heading'ine (yön açısı) göre en uygun route'u seç
 */
class RouteService {
  private lineRoutesMap: Map<string, RouteDirection[]> = new Map();
  private stopRouteMap: Map<number, { routeId: number; index: number; direction: string }[]> = new Map();

  constructor() {
    this.loadRoutes();
  }

  private loadRoutes(): void {
    try {
      const data = routesData as LineRoutes[];

      // Hat -> Routes map
      data.forEach(item => {
        this.lineRoutesMap.set(item.line.toUpperCase(), item.routes);

        // Her durak için hangi route'larda olduğunu indexle
        item.routes.forEach(route => {
          route.stopIds.forEach((stopId, index) => {
            if (!this.stopRouteMap.has(stopId)) {
              this.stopRouteMap.set(stopId, []);
            }
            this.stopRouteMap.get(stopId)!.push({
              routeId: route.routeId,
              index,
              direction: route.direction
            });
          });
        });
      });

      devLog(`[RouteService] ${data.length} hat, ${this.stopRouteMap.size} durak-route eşleştirmesi yüklendi`);
    } catch (error) {
      console.error('[RouteService] Route verileri yüklenemedi:', error);
    }
  }

  /**
   * Route ID'den direkt route bilgisini al
   * MQTT'den gelen route ID ile yön bilgisi alınır
   */
  getRouteInfo(routeId: number): { line: string; direction: string } | null {
    // Route ID -> Line mapping için tüm verileri tara
    for (const [line, routes] of this.lineRoutesMap.entries()) {
      const route = routes.find(r => r.routeId === routeId);
      if (route) {
        return {
          line,
          direction: route.direction
        };
      }
    }
    return null;
  }

  /**
   * Bir hat için tüm yönleri getir
   */
  getDirectionsForLine(line: string): string[] {
    const normalizedLine = line.toUpperCase().trim();
    const routes = this.lineRoutesMap.get(normalizedLine);

    if (!routes) {
      // Varyant eşleştirme: "16" -> "16M", "16S" vb.
      if (/^\d+$/.test(normalizedLine)) {
        const allDirections: string[] = [];
        this.lineRoutesMap.forEach((routes, key) => {
          if (key.startsWith(normalizedLine) && key.length > normalizedLine.length) {
            routes.forEach(r => allDirections.push(`${key}: ${r.direction}`));
          }
        });
        return [...new Set(allDirections)];
      }
      return [];
    }

    return routes.map(r => r.direction);
  }

  getRouteOptionsForLine(line: string): RouteDirectionOption[] {
    const normalizedLine = line.toUpperCase().trim();
    const routes = this.lineRoutesMap.get(normalizedLine);
    if (!routes) {
      if (/^\d+$/.test(normalizedLine)) {
        const options: RouteDirectionOption[] = [];
        this.lineRoutesMap.forEach((variantRoutes, key) => {
          if (key.startsWith(normalizedLine) && key.length > normalizedLine.length) {
            variantRoutes.forEach(route => {
              options.push({
                line: key,
                routeId: route.routeId,
                direction: route.direction,
                label: this.formatDirection(route.direction),
              });
            });
          }
        });
        return options;
      }

      return [];
    }

    return routes.map(route => ({
      line: normalizedLine,
      routeId: route.routeId,
      direction: route.direction,
      label: this.formatDirection(route.direction),
    }));
  }

  /**
   * Aracın yönünü belirle
   *
   * @param line Hat numarası (örn: "23S")
   * @param vehicleLocation Aracın konumu
   * @param nearestStopId Aracın en yakın olduğu durak ID'si
   * @param heading Aracın yön açısı (0-360, opsiyonel)
   */
  determineDirection(
    line: string,
    vehicleLocation: Coordinates,
    nearestStopId: number,
    heading?: number
  ): DirectionResult | null {
    const normalizedLine = line.toUpperCase().trim();
    const routes = this.lineRoutesMap.get(normalizedLine);

    if (!routes || routes.length === 0) {
      return null;
    }

    // Tek yön varsa direkt döndür
    if (routes.length === 1) {
      return {
        direction: routes[0].direction,
        routeId: routes[0].routeId,
        confidence: 'high'
      };
    }

    // Durak bu route'lardan hangisinde?
    const stopRoutes = this.stopRouteMap.get(nearestStopId);
    if (!stopRoutes) {
      // Durak route'larda yok, ilk yönü döndür
      return {
        direction: routes[0].direction,
        routeId: routes[0].routeId,
        confidence: 'low'
      };
    }

    // Bu hattın route'larını filtrele
    const matchingRoutes = stopRoutes.filter(sr =>
      routes.some(r => r.routeId === sr.routeId)
    );

    if (matchingRoutes.length === 0) {
      return {
        direction: routes[0].direction,
        routeId: routes[0].routeId,
        confidence: 'low'
      };
    }

    if (matchingRoutes.length === 1) {
      return {
        direction: matchingRoutes[0].direction,
        routeId: matchingRoutes[0].routeId,
        confidence: 'high'
      };
    }

    // Birden fazla eşleşme varsa, durak index'ine göre karar ver
    // Düşük index = rotanın başına yakın = o yöne gidiyor
    // Yüksek index = rotanın sonuna yakın = ters yöne gidiyor olabilir

    // En düşük index'li route'u seç (rotanın başına daha yakın)
    const sortedByIndex = matchingRoutes.sort((a, b) => {
      // Normalize index (0-1 arası)
      const routeA = routes.find(r => r.routeId === a.routeId)!;
      const routeB = routes.find(r => r.routeId === b.routeId)!;
      const normalizedA = a.index / routeA.stopIds.length;
      const normalizedB = b.index / routeB.stopIds.length;
      return normalizedA - normalizedB;
    });

    return {
      direction: sortedByIndex[0].direction,
      routeId: sortedByIndex[0].routeId,
      confidence: 'medium'
    };
  }

  /**
   * Durak ID'sinden yön bilgilerini getir
   */
  getDirectionsAtStop(stopId: number, line: string): string[] {
    const normalizedLine = line.toUpperCase().trim();
    const routes = this.lineRoutesMap.get(normalizedLine);

    if (!routes) return [];

    const stopRoutes = this.stopRouteMap.get(stopId);
    if (!stopRoutes) return [];

    // Bu hattın bu duraktan geçen route'larını bul
    const directions: string[] = [];
    stopRoutes.forEach(sr => {
      const route = routes.find(r => r.routeId === sr.routeId);
      if (route) {
        directions.push(route.direction);
      }
    });

    return [...new Set(directions)];
  }

  /**
   * Yön bilgisini kısa formata çevir
   * "BATIKENT - ODUNPAZARI" -> "Batıkent yönü"
   */
  formatDirection(direction: string): string {
    if (!direction) return '';

    const parts = direction.split(' - ');
    if (parts.length >= 2) {
      // Son kısmı al (hedef)
      const destination = parts[parts.length - 1]
        .replace(/\s*\(.*\)\s*$/, '') // Parantez içini kaldır
        .trim();

      // İlk harfi büyük, geri kalanı küçük
      const formatted = destination.charAt(0).toUpperCase() +
                       destination.slice(1).toLowerCase();

      return `${formatted} yönü`;
    }

    return direction;
  }

  /**
   * Route üzerinde iki durak arasındaki durak sayısını hesapla
   * Araç konumuna en yakın durağı bulup hedef durağa kaç durak olduğunu döndürür
   *
   * @param routeId Rota ID'si
   * @param vehicleStopId Aracın en yakın olduğu durak ID'si
   * @param targetStopId Hedef durak ID'si
   * @returns Aradaki durak sayısı veya null (bulunamazsa)
   */
  getStopsBetween(routeId: number, vehicleStopId: number, targetStopId: number): number | null {
    // Route'u bul
    let foundRoute: RouteDirection | null = null;

    for (const routes of this.lineRoutesMap.values()) {
      const route = routes.find(r => r.routeId === routeId);
      if (route) {
        foundRoute = route;
        break;
      }
    }

    if (!foundRoute) {
      return null;
    }

    const vehicleIndex = foundRoute.stopIds.indexOf(vehicleStopId);
    const targetIndex = foundRoute.stopIds.indexOf(targetStopId);

    // Her iki durak da bu rotada mı?
    if (vehicleIndex === -1 || targetIndex === -1) {
      return null;
    }

    // Araç hedefin gerisinde mi? (index küçük = rotanın başına yakın)
    if (vehicleIndex < targetIndex) {
      // Araç hedeften önce - normal durum
      return targetIndex - vehicleIndex;
    } else {
      // Araç hedefi geçmiş veya aynı durakta
      return 0;
    }
  }

  /**
   * Araç konumuna en yakın durak ID'sini route üzerinde bul
   * @param routeId Rota ID'si
   * @param vehicleLocation Araç konumu
   * @param stopsData Tüm durakların konum bilgisi (stopId -> coordinates)
   */
  findNearestStopOnRoute(
    routeId: number,
    vehicleLocation: Coordinates,
    stopsData: Map<number, Coordinates>
  ): number | null {
    // Route'u bul
    let foundRoute: RouteDirection | null = null;

    for (const routes of this.lineRoutesMap.values()) {
      const route = routes.find(r => r.routeId === routeId);
      if (route) {
        foundRoute = route;
        break;
      }
    }

    if (!foundRoute) {
      return null;
    }

    let nearestStopId: number | null = null;
    let minDistance = Infinity;

    // Haversine mesafe hesaplama (inline)
    const toRad = (deg: number) => deg * (Math.PI / 180);
    const haversine = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
      const R = 6371000; // Earth radius in meters
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    for (const stopId of foundRoute.stopIds) {
      const stopCoords = stopsData.get(stopId);
      if (!stopCoords) continue;

      const dist = haversine(
        vehicleLocation.latitude,
        vehicleLocation.longitude,
        stopCoords.latitude,
        stopCoords.longitude
      );

      if (dist < minDistance) {
        minDistance = dist;
        nearestStopId = stopId;
      }
    }

    return nearestStopId;
  }

  /**
   * Rota üzerinden iki durak arasındaki GERÇEK yol mesafesini hesaplar.
   * Kuş uçuşu yerine, rotadaki ardışık duraklar arası mesafeleri toplar.
   *
   * @param routeId Rota ID'si
   * @param fromStopId Başlangıç durağı (aracın en yakın olduğu durak)
   * @param toStopId Hedef durak
   * @param stopsData stopId -> Coordinates haritası
   * @returns Metre cinsinden rota mesafesi, hesaplanamazsa null
   */
  getRouteDistanceMeters(
    routeId: number,
    fromStopId: number,
    toStopId: number,
    stopsData: Map<number, Coordinates>
  ): number | null {
    const stops = this.getRouteStops(routeId);
    if (!stops) return null;

    const fromIndex = stops.indexOf(fromStopId);
    const toIndex = stops.indexOf(toStopId);

    // Her iki durak da rotada olmalı ve araç hedeften önce gelmeli
    if (fromIndex === -1 || toIndex === -1 || fromIndex > toIndex) {
      return null;
    }

    let totalMeters = 0;
    let missingSegments = 0;
    const segmentCount = toIndex - fromIndex;

    for (let i = fromIndex; i < toIndex; i++) {
      const a = stopsData.get(stops[i]);
      const b = stopsData.get(stops[i + 1]);
      if (a && b) {
        totalMeters += calculateHaversineDistance(a, b);
      } else {
        // Koordinatı eksik durak: segment atlanırsa mesafe olduğundan kısa çıkar
        missingSegments++;
      }
    }

    // Segmentlerin %20'sinden fazlası ölçülemiyorsa mesafe güvenilmez sayılır;
    // null dönüp çağıran tarafın kuşuçuşu fallback'ine düşmesini sağla.
    if (segmentCount > 0 && missingSegments / segmentCount > 0.2) {
      return null;
    }

    return totalMeters;
  }

  /**
   * Route üzerindeki durak listesini getir
   */
  getRouteStops(routeId: number): number[] | null {
    for (const routes of this.lineRoutesMap.values()) {
      const route = routes.find(r => r.routeId === routeId);
      if (route) {
        return route.stopIds;
      }
    }
    return null;
  }

  /**
   * Hedef durak bu rotada mı? Ve araç henüz geçmedi mi?
   * @param routeId Aracın route ID'si
   * @param targetStopId Hedef durak ID'si (Wialon ID)
   * @param vehicleNearestStopId Aracın şu an en yakın olduğu durak ID'si
   * @returns true = araç bu durağa uğrayacak, false = uğramayacak (rotada yok veya geçti)
   */
  isStopOnRouteAhead(routeId: number, targetStopId: number, vehicleNearestStopId: number | null): boolean {
    const routeStops = this.getRouteStops(routeId);

    if (!routeStops) {
      return false; // Route bulunamadı
    }

    const targetIndex = routeStops.indexOf(targetStopId);

    if (targetIndex === -1) {
      return false; // Hedef durak bu rotada yok
    }

    // Araç konumu bilinmiyorsa, rotada olması yeterli
    if (!vehicleNearestStopId) {
      return true;
    }

    const vehicleIndex = routeStops.indexOf(vehicleNearestStopId);

    if (vehicleIndex === -1) {
      return true; // Araç konumu rotada bulunamadı, varsayılan olarak kabul et
    }

    // Araç hedef duraktan ÖNCE mi? (daha düşük index = rotanın başına daha yakın)
    return vehicleIndex <= targetIndex;
  }

  /**
   * Bir duraktan geçen tüm hatların yön bilgilerini getir
   */
  getAllDirectionsAtStop(stopId: number): Map<string, string[]> {
    const result = new Map<string, string[]>();
    const stopRoutes = this.stopRouteMap.get(stopId);

    if (!stopRoutes) return result;

    stopRoutes.forEach(sr => {
      // Bu route'un ait olduğu hattı bul
      this.lineRoutesMap.forEach((routes, line) => {
        const route = routes.find(r => r.routeId === sr.routeId);
        if (route) {
          if (!result.has(line)) {
            result.set(line, []);
          }
          const directions = result.get(line)!;
          if (!directions.includes(route.direction)) {
            directions.push(route.direction);
          }
        }
      });
    });

    return result;
  }
}

const routeService = new RouteService();
export default routeService;
