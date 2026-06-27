import { Coordinates, BusPosition, ETAResult, ScheduledArrival } from '../types/shared-types';
import { calculateHaversineDistance } from '../utils/geo.utils';
import stopService from './stops/StopService';
import routeService from './routes/RouteService';
import nimbusService from './NimbusService';
import { devLog } from '../utils/devLog';
import { config } from '../config';

const DEFAULT_BUS_SPEED_KMH = config.app.defaultBusSpeedKmh;

// ETA hesaplama sabitleri
const STOP_DELAY_SECONDS = 25; // Her durak için ortalama bekleme süresi (saniye)
const ROAD_DISTANCE_FACTOR = 1.25; // Kuş uçuşu -> gerçek yol mesafe düzeltme faktörü

/**
 * ETA Service - Durak bazlı ETA hesaplaması yapar
 *
 * Algoritma:
 * 1. Kullanıcının en yakın durağını bul (hat filtresi OLMADAN)
 * 2. O duraktan geçen hatları kontrol et
 * 3. Sorgulanan hat o duraktan geçiyor mu? (varyantlar dahil: 16 → 16M, 16S)
 * 4. Geçiyorsa → o hattaki araçların ETA'sını hesapla
 * 5. Geçmiyorsa → "Bu hat bu duraktan geçmiyor" de
 */
class ETAService {
  /**
   * Hat eşleştirme - varyantları da kontrol eder
   * "16" sorgusu → "16S", "16M", "16K" hepsini eşleştirir
   * "16M" sorgusu → sadece "16M" eşleştirir
   * "23" sorgusu → "23S" eşleşir
   */
  private matchLine(query: string, line: string): boolean {
    const q = query.toUpperCase().trim();
    const l = line.toUpperCase().trim();

    // Tam eşleşme
    if (q === l) return true;

    // Sorgu base hat ise (sadece sayı), varyantları da eşleştir
    // Örn: "16" sorgusu → "16M", "16S", "16K", "16K-NÖBET" de eşleşir
    if (/^\d+$/.test(q)) {
      // l, q ile başlayıp harf/tire ile devam ediyorsa eşleşir
      // 16 → 16S, 16M, 16K, 16K-NÖBET
      const regex = new RegExp(`^${q}[A-Z]`);
      return regex.test(l);
    }

    // Sorgu varyantlı ise (16M gibi), tam eşleşme veya alt varyant
    // 16M → 16M eşleşir
    // 4K → 4K, 4K-NÖBET eşleşir
    if (/^\d+[A-Z]$/.test(q)) {
      return l === q || l.startsWith(q + '-');
    }

    return false;
  }

  /**
   * Duraktaki hatlardan sorguyla eşleşenleri bul
   */
  private findMatchingLinesAtStop(query: string, stopLines: string[]): string[] {
    return stopLines.filter(stopLine => this.matchLine(query, stopLine));
  }

  /**
   * ETA hesapla - DURAK BAZLI
   */
  calculateETA(
    userLocation: Coordinates,
    line: string,
    vehicles: BusPosition[]
  ): ETAResult {
    devLog('');
    devLog('🔍 ═══ ETA DEBUG (DURAK BAZLI) ═══');
    devLog(`🔍 Sorgulanan hat: "${line}"`);
    devLog(`🔍 Toplam araç sayısı: ${vehicles.length}`);

    // 1. Kullanıcının EN YAKIN DURAĞINI bul (hat filtresi YOK)
    const nearestStopResult = stopService.findNearestStop(userLocation);

    if (!nearestStopResult.stop) {
      devLog('🔍 ❌ Yakında durak bulunamadı');
      devLog('🔍 ═══════════════');
      return {
        status: 'no_nearby_stop',
        line,
        errorMessage: 'Yakınınızda durak bulunamadı.',
      };
    }

    const targetStop = nearestStopResult.stop;
    devLog(`🔍 📍 En yakın durak: ${targetStop.name} (${Math.round(nearestStopResult.distance)}m)`);
    devLog(`🔍 📍 Duraktan geçen hatlar: ${targetStop.lines.join(', ')}`);

    // 2. Sorgulanan hat bu duraktan geçiyor mu?
    const matchingLines = this.findMatchingLinesAtStop(line, targetStop.lines);
    devLog(`🔍 🔎 "${line}" ile eşleşen hatlar: ${matchingLines.length > 0 ? matchingLines.join(', ') : 'YOK'}`);

    if (matchingLines.length === 0) {
      // Bu hat bu duraktan geçmiyor
      devLog(`🔍 ❌ "${line}" hattı "${targetStop.name}" durağından GEÇMİYOR`);
      devLog('🔍 ═══════════════');
      return {
        status: 'no_nearby_stop',
        line,
        stopName: targetStop.name,
        stopId: targetStop.id,
        errorMessage: `${line} hattı "${targetStop.name}" durağından geçmiyor. Bu duraktan geçen hatlar: ${targetStop.lines.join(', ')}`,
      };
    }

    // 3. Eşleşen hatlardaki araçları bul
    const normalizedQuery = line.toUpperCase().trim();
    const lineVehicles = vehicles.filter(v => {
      const vehicleLine = (v.line || '').toUpperCase().trim();
      // Araç hattı, eşleşen hatlardan biri mi?
      // Veya sorgu ile başlıyor mu? (16 sorgusu → 16, 16M, 16S)
      return matchingLines.some(ml => ml.toUpperCase() === vehicleLine) ||
             vehicleLine === normalizedQuery ||
             ((/^\d+$/.test(normalizedQuery)) && vehicleLine.startsWith(normalizedQuery));
    });

    devLog(`🔍 🚌 "${line}" hattında araç sayısı: ${lineVehicles.length}`);

    if (lineVehicles.length === 0) {
      // Hat geçiyor ama şu an aktif araç yok
      const allLines = [...new Set(vehicles.map(v => v.line))];
      const similar = allLines.filter(l =>
        l.toUpperCase().startsWith(normalizedQuery) ||
        normalizedQuery.startsWith(l.toUpperCase().replace(/[A-Z]$/, ''))
      );
      if (similar.length > 0) {
        devLog(`🔍 💡 Sistemde görünen benzer hatlar: ${similar.join(', ')}`);
      }
      devLog('🔍 ═══════════════');

      return {
        status: 'no_vehicle_approaching',
        line,
        stopName: targetStop.name,
        stopId: targetStop.id,
        errorMessage: `${line} hattında şu anda aktif araç görünmüyor.`,
      };
    }

    // 4. Durağa en yakın ve YAKLAŞAN aracı bul
    // Hedef durağın Wialon ID'si
    const targetWialonId = this.extractWialonId(targetStop.id);
    const stopsCoordMap = stopService.getStopCoordinatesMap();

    const vehiclesWithDistance = lineVehicles
      .map(vehicle => {
        const distanceToStop = calculateHaversineDistance(vehicle.coordinates, targetStop.coordinates);
        // Aracın durağa yaklaşıp yaklaşmadığını kontrol et (heading bazlı)
        const isApproaching = this.isVehicleApproachingStop(vehicle, targetStop.coordinates);

        // ÖNEMLİ: Aracın rotası bu durağa uğruyor mu?
        let willStopHere = true; // Varsayılan: route ID yoksa heading'e güven
        let vehicleNearestStopId: number | null = null;

        if (vehicle.routeId && targetWialonId) {
          // Aracın şu anki en yakın durağını bul (rota üzerinde)
          vehicleNearestStopId = routeService.findNearestStopOnRoute(
            vehicle.routeId,
            vehicle.coordinates,
            stopsCoordMap
          );

          // Bu rota hedef durağa uğruyor mu ve araç henüz geçmedi mi?
          willStopHere = routeService.isStopOnRouteAhead(
            vehicle.routeId,
            targetWialonId,
            vehicleNearestStopId
          );

          if (!willStopHere) {
            devLog(`🔍 ⚠️ Araç ${vehicle.line} (Route ${vehicle.routeId}) bu durağa UĞRAMAYACAK`);
          }
        }

        return {
          vehicle,
          distanceToStop,
          isApproaching,
          willStopHere,
          vehicleNearestStopId,
        };
      })
      // Sadece bu durağa uğrayacak araçları al
      .filter(v => v.willStopHere)
      // Önce yaklaşanları, sonra mesafeye göre sırala
      .sort((a, b) => {
        // Yaklaşan araçlar önce
        if (a.isApproaching && !b.isApproaching) return -1;
        if (!a.isApproaching && b.isApproaching) return 1;
        // Aynı durumdaysa mesafeye göre
        return a.distanceToStop - b.distanceToStop;
      });

    devLog(`🔍 🚌 Bu durağa uğrayacak araç sayısı: ${vehiclesWithDistance.length}/${lineVehicles.length}`);

    if (vehiclesWithDistance.length === 0) {
      devLog('🔍 ═══════════════');
      return {
        status: 'no_vehicle_approaching',
        line,
        stopName: targetStop.name,
        stopId: targetStop.id,
        errorMessage: `${line} hattında şu anda bu durağa gelecek araç yok (${lineVehicles.length} araç farklı yönde).`,
      };
    }

    // En az bir yaklaşan araç var mı?
    const approachingVehicles = vehiclesWithDistance.filter(v => v.isApproaching);
    const nearest = approachingVehicles.length > 0 ? approachingVehicles[0] : vehiclesWithDistance[0];

    devLog(`🔍 🚌 En yakın araç: ${nearest.vehicle.line} (ID: ${nearest.vehicle.deviceId}) - ${Math.round(nearest.distanceToStop)}m`);
    devLog(`🔍 🚌 Yaklaşıyor mu: ${nearest.isApproaching ? 'EVET ✅' : 'HAYIR ❌ (ters yönde)'}`);
    devLog(`🔍 🚌 Yaklaşan araç sayısı: ${approachingVehicles.length}/${vehiclesWithDistance.length}`);

    // Eğer hiç yaklaşan araç yoksa
    if (!nearest.isApproaching) {
      devLog('🔍 ═══════════════');
      return {
        status: 'no_vehicle_approaching',
        line,
        stopName: targetStop.name,
        stopId: targetStop.id,
        errorMessage: `${line} hattında şu anda durağa yaklaşan araç yok (${vehiclesWithDistance.length} araç ters yönde).`,
      };
    }

    // 5. ETA hesapla — rota üzerinden mesafe + STABİL hız
    // Anlık MQTT hızı çok dalgalı (araç durakta/ışıkta yavaşlayınca ETA zıplıyordu),
    // bu yüzden stabil bir ortalama seyir hızı kullanılır.
    const speedKmh = DEFAULT_BUS_SPEED_KMH;
    const speedMs = (speedKmh * 1000) / 3600;

    // Mesafe: mümkünse rota üzerinden (duraktan durağa), değilse kuş uçuşu x1.25
    const routeDistance =
      nearest.vehicle.routeId && targetWialonId && nearest.vehicleNearestStopId
        ? routeService.getRouteDistanceMeters(
            nearest.vehicle.routeId,
            nearest.vehicleNearestStopId,
            targetWialonId,
            stopsCoordMap
          )
        : null;

    let effectiveDistance: number;
    let distanceSource: string;

    if (routeDistance !== null) {
      // Aracın, rotadaki en yakın durağa olan kısa giriş mesafesini de ekle
      const firstStopCoords = stopsCoordMap.get(nearest.vehicleNearestStopId!);
      const leadIn = firstStopCoords
        ? calculateHaversineDistance(nearest.vehicle.coordinates, firstStopCoords)
        : 0;
      effectiveDistance = routeDistance + leadIn;
      distanceSource = 'rota';
    } else {
      effectiveDistance = nearest.distanceToStop * ROAD_DISTANCE_FACTOR;
      distanceSource = `kuşuçuşu x${ROAD_DISTANCE_FACTOR}`;
    }

    let etaSeconds = effectiveDistance / speedMs;

    // Aradaki duraklarda bekleme süresi
    let stopsBetween = 0;
    if (nearest.vehicle.routeId && targetWialonId && nearest.vehicleNearestStopId) {
      const stopsCount = routeService.getStopsBetween(
        nearest.vehicle.routeId,
        nearest.vehicleNearestStopId,
        targetWialonId
      );

      if (stopsCount !== null && stopsCount > 0) {
        stopsBetween = stopsCount;
        const stopDelayTotal = stopsBetween * STOP_DELAY_SECONDS;
        etaSeconds += stopDelayTotal;
        devLog(`🔍 🚏 Aradaki durak sayısı: ${stopsBetween} (+${stopDelayTotal} sn)`);
      }
    }

    const etaMinutes = Math.round(etaSeconds / 60);

    devLog(`🔍 ⏱️ Hız: ${speedKmh} km/h (stabil), Mesafe: ${Math.round(effectiveDistance)}m (${distanceSource}), ETA: ${etaMinutes} dk`);

    if (etaMinutes > 30) {
      return {
        status: 'no_vehicle_approaching',
        line,
        stopName: targetStop.name,
        stopId: targetStop.id,
        errorMessage: `${line} hattında yaklaşan araç görünmüyor (en yakın >30 dk).`,
      };
    }

    // 6. Yön bilgisini belirle (doğrudan route ID'den)
    let direction: string | undefined;
    let directionFull: string | undefined;

    // Route ID varsa, direkt route mapping'den yönü al (en güvenilir)
    if (nearest.vehicle.routeId) {
      const routeInfo = routeService.getRouteInfo(nearest.vehicle.routeId);
      if (routeInfo) {
        directionFull = routeInfo.direction;
        direction = routeService.formatDirection(routeInfo.direction);
        devLog(`🔍 🧭 Yön (Route ID ${nearest.vehicle.routeId}): ${direction}`);
      }
    }

    // Route ID yoksa eski yöntemi kullan (durak bazlı - daha az güvenilir)
    if (!direction) {
      const stopWialonId = this.extractWialonId(targetStop.id);
      if (stopWialonId) {
        const directionResult = routeService.determineDirection(
          nearest.vehicle.line,
          nearest.vehicle.coordinates,
          stopWialonId,
          nearest.vehicle.heading
        );
        if (directionResult) {
          directionFull = directionResult.direction;
          direction = routeService.formatDirection(directionResult.direction);
          devLog(`🔍 🧭 Yön (durak bazlı): ${direction} (${directionResult.confidence})`);
        }
      }
    }

    devLog('🔍 ═══════════════');

    return {
      status: 'ok',
      etaMinutes,
      stopName: targetStop.name,
      stopId: targetStop.id,
      line: nearest.vehicle.line, // Gerçek hat adını göster (16M gibi)
      direction,
      directionFull,
      busPosition: nearest.vehicle.coordinates,
      distance: Math.round(nearest.distanceToStop),
    };
  }

  /**
   * Stop ID'den Wialon ID'yi çıkar
   * "stop_557364" -> 557364
   */
  private extractWialonId(stopId: string): number | null {
    const match = stopId.match(/stop_(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }

  /**
   * Aracın durağa yaklaşıp yaklaşmadığını kontrol et
   * Heading (yön açısı) ile durak yönü karşılaştırılır
   */
  private isVehicleApproachingStop(vehicle: BusPosition, stopCoords: Coordinates): boolean {
    // Heading yoksa veya 0 ise, varsayılan olarak yaklaşıyor kabul et
    if (!vehicle.heading || vehicle.heading === 0) {
      return true;
    }

    // Araçtan durağa olan açıyı hesapla
    const bearingToStop = this.calculateBearing(
      vehicle.coordinates.latitude,
      vehicle.coordinates.longitude,
      stopCoords.latitude,
      stopCoords.longitude
    );

    // Heading ile durak yönü arasındaki fark
    let angleDiff = Math.abs(bearingToStop - vehicle.heading);
    if (angleDiff > 180) {
      angleDiff = 360 - angleDiff;
    }

    // 90 dereceden az fark varsa durağa doğru gidiyor
    // (ön yarım düzlemde)
    const isApproaching = angleDiff < 90;

    return isApproaching;
  }

  /**
   * İki nokta arasındaki bearing (yön açısı) hesapla
   * @returns 0-360 derece arası açı (0 = kuzey, 90 = doğu)
   */
  private calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const toRad = (deg: number) => deg * (Math.PI / 180);
    const toDeg = (rad: number) => rad * (180 / Math.PI);

    const dLon = toRad(lon2 - lon1);
    const lat1Rad = toRad(lat1);
    const lat2Rad = toRad(lat2);

    const y = Math.sin(dLon) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
              Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);

    let bearing = toDeg(Math.atan2(y, x));
    bearing = (bearing + 360) % 360; // 0-360 arasına normalize et

    return bearing;
  }

  /**
   * Nimbus API'den durak için tarifeli varış zamanlarını çek
   * @param stopWialonId Durak Wialon ID'si
   * @param line Filtrelenecek hat (opsiyonel)
   */
  async getScheduledArrivals(stopWialonId: number, line?: string): Promise<ScheduledArrival[]> {
    try {
      const arrivals = line
        ? await nimbusService.getLineArrivalsAtStop(stopWialonId, line)
        : await nimbusService.getStopArrivals(stopWialonId);

      return arrivals.map(a => ({
        line: a.line,
        direction: a.direction,
        etaMinutes: a.etaMinutes,
        source: 'nimbus' as const,
      }));
    } catch (error) {
      console.error('[ETAService] Error fetching scheduled arrivals:', error);
      return [];
    }
  }

  /**
   * ETA hesapla - Async versiyon (Nimbus fallback ile)
   * Canlı araç bulunamazsa Nimbus'tan tarifeli varış zamanlarını döndürür
   */
  async calculateETAWithSchedule(
    userLocation: Coordinates,
    line: string,
    vehicles: BusPosition[]
  ): Promise<ETAResult> {
    // Bizim rota-bazlı hesap: durak çözümü + Nimbus yoksa fallback olarak kullanılır
    const localResult = this.calculateETA(userLocation, line, vehicles);

    // Durak çözülebildiyse Nimbus'un kendi ETA'sını BİRİNCİL kaynak olarak dene.
    // Nimbus, gerçek yol geometrisi + geçmiş hız profiliyle hesapladığı için
    // bizim hesaptan daha stabil ve doğru.
    if (localResult.stopId) {
      const stopWialonId = this.extractWialonId(localResult.stopId);

      if (stopWialonId) {
        devLog(`🔍 📅 Nimbus ETA (birincil) çekiliyor...`);
        const scheduledArrivals = await this.getScheduledArrivals(stopWialonId, line);

        if (scheduledArrivals.length > 0) {
          const primary = scheduledArrivals[0]; // en yakın varış
          devLog(
            `🔍 ✅ Nimbus birincil ETA: ${primary.line} ${primary.direction} → ${primary.etaMinutes} dk`
          );

          return {
            ...localResult,
            status: 'ok',
            etaMinutes: primary.etaMinutes,
            line: localResult.line || primary.line,
            direction: primary.direction || localResult.direction,
            errorMessage: undefined, // eski local hata mesajını taşıma
            scheduledArrivals,
          };
        }

        devLog('🔍 ⚠️ Nimbus ETA vermedi, bizim rota-bazlı hesap kullanılıyor');
      }
    }

    // Nimbus veri vermediyse bizim sonuç (route-based ETA veya ilgili hata)
    return localResult;
  }
}

const etaService = new ETAService();
export default etaService;
