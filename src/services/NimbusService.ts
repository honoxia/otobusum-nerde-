import { config } from '../config';
import routeService from './routes/RouteService';

interface NimbusETA {
  uid: number | null;  // Araç ID (varsa)
  rid: number | null;  // ?
  pt: number;          // Planned time (Unix timestamp)
  in: number;
  ot: number;
  eta: {
    tt: number;        // Travel time in seconds
  };
}

interface NimbusRouteETA {
  id: number;          // Route ID
  tt: NimbusETA[];     // Arrival times
}

interface NimbusStopResponse {
  r: NimbusRouteETA[];
  tm: number;          // Server timestamp
}

export interface StopArrival {
  routeId: number;
  line: string;
  direction: string;
  etaMinutes: number;
  etaSeconds: number;
  vehicleId?: number;
  plannedTime?: Date;
}

/**
 * Nimbus API Service - Durak varış zamanlarını çeker
 */
class NimbusService {
  private readonly baseUrl: string;
  private readonly locatorHash: string;

  constructor() {
    this.baseUrl = 'https://nimbus.wialon.com/api/locator';
    this.locatorHash = config.nimbus.locatorHash;
  }

  /**
   * Locator sayfasına gömülü public Flespi token'ını çeker.
   * Belediyenin QR sistemi MQTT'ye bu token ile bağlanıyor; token sayfanın
   * APP_CONFIG objesinde açıkça duruyor. Rotasyona dayanıklı olmak için
   * elle .env'e yazmak yerine runtime'da buradan okunur.
   */
  async fetchLocatorToken(): Promise<string | null> {
    try {
      const url = `https://nimbus.wialon.com/locator/${this.locatorHash}`;
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`[NimbusService] Locator sayfası alınamadı: ${response.status}`);
        return null;
      }
      const html = await response.text();
      const match = html.match(/APP_CONFIG\s*=\s*'([^']+)'/);
      if (!match) {
        console.error('[NimbusService] APP_CONFIG bulunamadı');
        return null;
      }
      const appConfig = JSON.parse(match[1]);
      const token = appConfig.flespi_token;
      if (!token) {
        console.error('[NimbusService] flespi_token APP_CONFIG içinde yok');
        return null;
      }
      console.log('[NimbusService] ✅ Public Flespi token locator sayfasından alındı');
      return token;
    } catch (error) {
      console.error('[NimbusService] Token çekme hatası:', error);
      return null;
    }
  }

  /**
   * Durak için beklenen varış zamanlarını getir
   * @param stopWialonId Durak Wialon ID'si (örn: 557364)
   */
  async getStopArrivals(stopWialonId: number): Promise<StopArrival[]> {
    try {
      const url = `${this.baseUrl}/${this.locatorHash}/online/stop/${stopWialonId}`;
      console.log(`[NimbusService] Fetching arrivals for stop ${stopWialonId}`);

      const response = await fetch(url);

      if (!response.ok) {
        console.error(`[NimbusService] API error: ${response.status}`);
        return [];
      }

      const data: NimbusStopResponse = await response.json();
      const serverTime = data.tm;
      const arrivals: StopArrival[] = [];

      for (const route of data.r) {
        // Route ID'den hat bilgisini al
        const routeInfo = routeService.getRouteInfo(route.id);

        if (!routeInfo) {
          console.log(`[NimbusService] Unknown route ID: ${route.id}`);
          continue;
        }

        for (const arrival of route.tt) {
          const etaSeconds = arrival.eta.tt;
          const etaMinutes = Math.round(etaSeconds / 60);

          // Çok uzak olanları atla (24 saatten fazla)
          if (etaMinutes > 1440) {
            continue;
          }

          arrivals.push({
            routeId: route.id,
            line: routeInfo.line,
            direction: routeService.formatDirection(routeInfo.direction),
            etaMinutes,
            etaSeconds,
            vehicleId: arrival.uid || undefined,
            plannedTime: arrival.pt ? new Date(arrival.pt * 1000) : undefined,
          });
        }
      }

      // ETA'ya göre sırala
      arrivals.sort((a, b) => a.etaSeconds - b.etaSeconds);

      console.log(`[NimbusService] Found ${arrivals.length} arrivals for stop ${stopWialonId}`);
      return arrivals;

    } catch (error) {
      console.error('[NimbusService] Error fetching arrivals:', error);
      return [];
    }
  }

  /**
   * Belirli bir hat için durak varış zamanlarını getir
   * @param stopWialonId Durak Wialon ID'si
   * @param line Hat numarası (örn: "23S", "16M")
   */
  async getLineArrivalsAtStop(stopWialonId: number, line: string): Promise<StopArrival[]> {
    const allArrivals = await this.getStopArrivals(stopWialonId);

    const normalizedLine = line.toUpperCase().trim();

    return allArrivals.filter(arrival => {
      const arrivalLine = arrival.line.toUpperCase();

      // Tam eşleşme
      if (arrivalLine === normalizedLine) return true;

      // Base hat sorgusu (16 -> 16M, 16S)
      if (/^\d+$/.test(normalizedLine)) {
        return arrivalLine.startsWith(normalizedLine) &&
               arrivalLine.length > normalizedLine.length;
      }

      return false;
    });
  }
}

const nimbusService = new NimbusService();
export default nimbusService;
