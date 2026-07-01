import { Coordinates, BusPosition, ETAResult, ScheduledArrival, BusStop } from '../types/shared-types';
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
const MAX_DISPLAY_ETA_MINUTES = 30;
// Nimbus tarifeli varışlar otoriter kaynak; seyrek hatlarda dar sınır gerçek
// varışları gizliyordu (16M Yaşamkent yönü ~91 dk). Aynı servis penceresini
// gösterecek kadar geniş, ertesi güne sarkan kayıtları eleyecek kadar dar tut.
const MAX_SCHEDULE_ETA_MINUTES = 180;
const NEARBY_LINE_STOP_CANDIDATE_METERS = 250;

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
    vehicles: BusPosition[],
    preferredDirectionFull?: string | null
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
      const routeInfo = v.routeId ? routeService.getRouteInfo(v.routeId) : null;
      const routeLine = (routeInfo?.line || '').toUpperCase().trim();
      const candidateLines = [vehicleLine, routeLine].filter(Boolean);
      // Araç hattı, eşleşen hatlardan biri mi?
      // Veya sorgu ile başlıyor mu? (16 sorgusu → 16, 16M, 16S)
      const lineMatches = candidateLines.some(candidateLine =>
        matchingLines.some(ml => ml.toUpperCase() === candidateLine) ||
        candidateLine === normalizedQuery ||
        this.matchLine(normalizedQuery, candidateLine) ||
        this.matchLine(candidateLine, normalizedQuery)
      );

      if (!lineMatches) return false;
      if (!preferredDirectionFull) return true;
      if (!v.routeId) return false;

      return routeInfo?.direction === preferredDirectionFull;
    });

    devLog(`🔍 🚌 "${line}" hattında araç sayısı: ${lineVehicles.length}`);
    if (preferredDirectionFull) {
      devLog(`🔍 🧭 Seçili yön filtresi: ${routeService.formatDirection(preferredDirectionFull)}`);
    }

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

    const targetStopCandidates = (nearestStopResult.allNearbyStops || [{ stop: targetStop, distance: nearestStopResult.distance }])
      .filter(item => item.distance <= Math.max(NEARBY_LINE_STOP_CANDIDATE_METERS, nearestStopResult.distance + 75))
      .filter(item => this.findMatchingLinesAtStop(line, item.stop.lines).length > 0);
    const lineStopCandidates = targetStopCandidates.length > 0
      ? targetStopCandidates
      : [{ stop: targetStop, distance: nearestStopResult.distance }];

    devLog(
      `🔍 🚏 Yakın aday duraklar: ${lineStopCandidates
        .map(item => `${item.stop.name} (${Math.round(item.distance)}m)`)
        .join(', ')}`
    );

    // 4. Durağa en yakın ve YAKLAŞAN aracı bul
    const stopsCoordMap = stopService.getStopCoordinatesMap();

    const vehiclesWithDistance = lineVehicles
      .map(vehicle => {
        // ÖNEMLİ: Aracın rotası bu durağa uğruyor mu?
        let willStopHere = true; // Varsayılan: route ID yoksa heading'e güven
        let vehicleNearestStopId: number | null = null;
        let selectedTargetStop = lineStopCandidates[0].stop;
        let selectedTargetWialonId = this.extractWialonId(selectedTargetStop.id);

        if (vehicle.routeId) {
          // Aracın şu anki en yakın durağını bul (rota üzerinde)
          vehicleNearestStopId = routeService.findNearestStopOnRoute(
            vehicle.routeId,
            vehicle.coordinates,
            stopsCoordMap
          );

          const matchingCandidate = lineStopCandidates.find(candidate => {
            const candidateWialonId = this.extractWialonId(candidate.stop.id);
            return candidateWialonId
              ? routeService.isStopOnRouteAhead(vehicle.routeId!, candidateWialonId, vehicleNearestStopId)
              : false;
          });

          if (matchingCandidate) {
            selectedTargetStop = matchingCandidate.stop;
            selectedTargetWialonId = this.extractWialonId(selectedTargetStop.id);
            willStopHere = true;
          } else {
            willStopHere = false;
          }

          if (!willStopHere) {
            devLog(`🔍 ⚠️ Araç ${vehicle.line} (Route ${vehicle.routeId}) bu durağa UĞRAMAYACAK`);
          } else if (selectedTargetStop.id !== targetStop.id) {
            devLog(`🔍 🔄 Araç ${vehicle.line} için yön durağı seçildi: ${selectedTargetStop.name}`);
          }
        }

        const distanceToStop = calculateHaversineDistance(vehicle.coordinates, selectedTargetStop.coordinates);
        // Aracın durağa yaklaşıp yaklaşmadığını kontrol et (heading bazlı)
        const isApproaching = this.isVehicleApproachingStop(vehicle, selectedTargetStop.coordinates);

        return {
          vehicle,
          distanceToStop,
          isApproaching,
          willStopHere,
          vehicleNearestStopId,
          targetStop: selectedTargetStop,
          targetWialonId: selectedTargetWialonId,
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

    const routeVerifiedTarget = Boolean(nearest.vehicle.routeId && nearest.targetWialonId);

    // Route ID yoksa heading'e mahkumuz; route ID varsa "durak ileride mi?" kontrolü
    // daha güvenilir olduğu için heading'i sadece sıralama sinyali olarak kullanırız.
    if (!nearest.isApproaching && !routeVerifiedTarget) {
      devLog('🔍 ═══════════════');
      return {
        status: 'no_vehicle_approaching',
        line,
        stopName: targetStop.name,
        stopId: targetStop.id,
        errorMessage: `${line} hattında şu anda durağa yaklaşan araç yok (${vehiclesWithDistance.length} araç ters yönde).`,
      };
    } else if (!nearest.isApproaching && routeVerifiedTarget) {
      devLog('🔍 🧭 Heading ters görünüyor ama Route ID hedef durağı doğruladı; ETA hesaplanıyor');
    }

    // 5. ETA hesapla — rota üzerinden mesafe + STABİL hız
    // Anlık MQTT hızı çok dalgalı (araç durakta/ışıkta yavaşlayınca ETA zıplıyordu),
    // bu yüzden stabil bir ortalama seyir hızı kullanılır.
    const speedKmh = DEFAULT_BUS_SPEED_KMH;
    const speedMs = (speedKmh * 1000) / 3600;

    // Mesafe: mümkünse rota üzerinden (duraktan durağa), değilse kuş uçuşu x1.25
    const routeDistance =
      nearest.vehicle.routeId && nearest.targetWialonId && nearest.vehicleNearestStopId
        ? routeService.getRouteDistanceMeters(
            nearest.vehicle.routeId,
            nearest.vehicleNearestStopId,
            nearest.targetWialonId,
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
    if (nearest.vehicle.routeId && nearest.targetWialonId && nearest.vehicleNearestStopId) {
      const stopsCount = routeService.getStopsBetween(
        nearest.vehicle.routeId,
        nearest.vehicleNearestStopId,
        nearest.targetWialonId
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

    if (etaMinutes > MAX_DISPLAY_ETA_MINUTES) {
      return {
        status: 'no_vehicle_approaching',
        line,
        stopName: nearest.targetStop.name,
        stopId: nearest.targetStop.id,
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
      const stopWialonId = this.extractWialonId(nearest.targetStop.id);
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
      stopName: nearest.targetStop.name,
      stopId: nearest.targetStop.id,
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
   * Durak adını "taraf"tan bağımsız temel isme indirger.
   * "EYÜP SULTAN CAMİ-1" ve "952 EYÜP SULTAN CAMİ-2" -> "EYÜP SULTAN CAMİ"
   * Böylece aynı durağın iki yönü eşleştirilir, farklı duraklar dışlanır.
   */
  private normalizeStopBase(name: string): string {
    return name
      .replace(/^\d+\s+/, '')   // baştaki durak no ("952 ")
      .replace(/-\d+$/, '')      // sondaki taraf eki ("-1", "-2")
      .trim()
      .toUpperCase();
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
    vehicles: BusPosition[],
    preferredDirectionFull?: string | null
  ): Promise<ETAResult> {
    // Bizim rota-bazlı hesap: durak çözümü + Nimbus yoksa fallback olarak kullanılır
    const localResult = this.calculateETA(userLocation, line, vehicles, preferredDirectionFull);

    // Nimbus'un kendi ETA'sını BİRİNCİL kaynak olarak dene.
    // Nimbus, gerçek yol geometrisi + geçmiş hız profiliyle hesapladığı için
    // bizim hesaptan daha stabil ve doğru.
    // ÖNEMLİ: Yakın durağın HER İKİ yön tarafını (örn. CAMİ-1 + CAMİ-2) sorgularız.
    // Böylece bir yönün varışı diğer taraftaki durakta olsa bile kaçmaz; canlı araç
    // bulunamasa dahi doğru durak tarafı otomatik yakalanır.
    const nearestStopResult = stopService.findNearestStop(userLocation);

    if (nearestStopResult.stop) {
      // Yalnızca kullanıcının durağının İKİ TARAFINI sorgula (örn. CAMİ-1 + CAMİ-2).
      // Aynı hattı taşıyan başka yakın duraklar (AKTEPE, PARK WEST) dahil edilirse
      // aynı araç iki durakta sayılıp "1 dk arayla" sahte varış üretiyordu.
      const nearestBase = this.normalizeStopBase(nearestStopResult.stop.name);
      const candidateStops = (nearestStopResult.allNearbyStops || [{ stop: nearestStopResult.stop, distance: nearestStopResult.distance }])
        .filter(item => this.normalizeStopBase(item.stop.name) === nearestBase)
        .filter(item => this.findMatchingLinesAtStop(line, item.stop.lines).length > 0);

      const stopsToQuery = candidateStops.length > 0
        ? candidateStops
        : [{ stop: nearestStopResult.stop, distance: nearestStopResult.distance }];

      // Aynı wialonId'yi iki kez sorgulamamak için tarafları tekilleştir (id -> durak)
      const uniqueStops = new Map<number, BusStop>();
      for (const item of stopsToQuery) {
        const wid = this.extractWialonId(item.stop.id);
        if (wid !== null && !uniqueStops.has(wid)) {
          uniqueStops.set(wid, item.stop);
        }
      }

      const directionLabel = preferredDirectionFull
        ? routeService.formatDirection(preferredDirectionFull)
        : null;

      if (uniqueStops.size > 0) {
        devLog(`🔍 📅 Nimbus ETA (birincil) çekiliyor... (${uniqueStops.size} durak tarafı)`);

        const stopEntries = [...uniqueStops.entries()];
        const arrivalGroups = await Promise.all(
          stopEntries.map(([wid]) => this.getScheduledArrivals(wid, line))
        );

        // Her varışı geldiği durakla eşle; böylece yöne göre doğru tarafın
        // (CAMİ-1 / CAMİ-2) gerçek adını gösterebiliriz.
        const withStop = arrivalGroups.flatMap((arrivals, idx) =>
          arrivals.map(arrival => ({ arrival, stop: stopEntries[idx][1] }))
        );

        const scheduledArrivals = withStop
          .filter(({ arrival }) => !directionLabel || arrival.direction === directionLabel)
          .filter(({ arrival }) => arrival.etaMinutes <= MAX_SCHEDULE_ETA_MINUTES)
          .sort((a, b) => a.arrival.etaMinutes - b.arrival.etaMinutes);

        if (scheduledArrivals.length > 0) {
          const primary = scheduledArrivals[0]; // en yakın varış
          devLog(
            `🔍 ✅ Nimbus birincil ETA: ${primary.arrival.line} ${primary.arrival.direction} → ${primary.arrival.etaMinutes} dk @ ${primary.stop.name}`
          );

          return {
            ...localResult,
            status: 'ok',
            etaMinutes: primary.arrival.etaMinutes,
            // Varışın gerçekleştiği durağı göster (yöne göre doğru taraf)
            stopName: primary.stop.name,
            stopId: primary.stop.id,
            line: localResult.line || primary.arrival.line,
            direction: primary.arrival.direction || localResult.direction,
            errorMessage: undefined, // eski local hata mesajını taşıma
            scheduledArrivals: scheduledArrivals.map(item => item.arrival),
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
