import { config } from '../../config';
import { Coordinates, TramStop } from '../../types/shared-types';
import { calculateHaversineDistance } from '../../utils/geo.utils';
import { devLog } from '../../utils/devLog';

interface NimbusStop {
  id: number;
  n: string;
  tp?: number;
  p?: Array<{ x: number; y: number; r?: number }>;
}

interface NimbusRoute {
  id: number;
  n?: string;
  d?: string;
}

interface NimbusFeedResponse {
  stops?: NimbusStop[];
  routes?: NimbusRoute[];
  tm?: number;
}

interface NimbusStopArrival {
  uid: number | null;
  rid: number | null;
  pt: number;
  eta?: {
    tt: number;
  };
}

interface NimbusStopRoute {
  id: number;
  tt: NimbusStopArrival[];
}

interface NimbusOnlineStopResponse {
  r?: NimbusStopRoute[];
  tm?: number;
}

export interface LiveTramArrival {
  routeId: number;
  lineRef: string;
  routeName: string;
  etaMinutes: number;
  etaSeconds: number;
  arrivalTime: string;
  vehicleId?: number;
  source: 'nimbus';
}

export interface LiveTramStopArrivals {
  nimbusStopId: number;
  nimbusStopName: string;
  matchedDistanceMeters: number;
  arrivals: LiveTramArrival[];
}

const FEED_CACHE_TTL_MS = 5 * 60 * 1000;
const STOP_MATCH_MAX_DISTANCE_METERS = 140;
const STALE_LIVE_ARRIVAL_SECONDS = 2 * 60;

function nimbusStopCoordinates(stop: NimbusStop): Coordinates | null {
  const point = stop.p?.[0];
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;

  return {
    latitude: point.y,
    longitude: point.x,
  };
}

function secondsToClock(epochSeconds: number): string {
  const date = new Date(epochSeconds * 1000);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function normalizeRouteName(value: string): string {
  return value
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0130/g, 'I')
    .replace(/\u015e/g, 'S')
    .replace(/\u011e/g, 'G')
    .replace(/\u00dc/g, 'U')
    .replace(/\u00d6/g, 'O')
    .replace(/\u00c7/g, 'C');
}

function inferLineRef(routeName: string): string {
  const normalized = normalizeRouteName(routeName);

  if (normalized.includes('BATIKENT')) return 'T8';
  if (normalized.includes('CAMLICA')) return 'T9';
  if (normalized.includes('75.YIL')) return '12';
  if (normalized.includes('CANKAYA')) return '7';
  if (normalized.includes('KUMLUBEL') || normalized.includes('SEHIR HASTANESI')) {
    return 'T10';
  }
  if (normalized.includes('OTOGAR') && normalized.includes('SSK')) return 'T1';
  if (normalized.includes('OGU')) {
    if (normalized.includes('OTOGAR')) return '36';
    if (normalized.includes('SSK')) return 'T3';
  }

  return 'Tramvay';
}

class TramNimbusService {
  private readonly baseUrl = 'https://nimbus.wialon.com/api/locator';
  private readonly locatorHash = config.nimbus.tramLocatorHash;
  private feedCache: { data: NimbusFeedResponse; fetchedAt: number } | null = null;
  private feedPromise: Promise<NimbusFeedResponse | null> | null = null;

  async getLiveArrivalsForStop(stop: TramStop, limit = 6): Promise<LiveTramStopArrivals | null> {
    try {
      const feed = await this.fetchFeed();
      if (!feed) return null;

      const matchedStop = this.findNearestNimbusStop(feed, stop);
      if (!matchedStop) return null;

      const response = await fetch(`${this.baseUrl}/${this.locatorHash}/online/stop/${matchedStop.stop.id}`);
      if (!response.ok) {
        devLog(`[TramNimbus] online/stop failed: ${response.status}`);
        return null;
      }

      const data = (await response.json()) as NimbusOnlineStopResponse;
      const serverTime = data.tm || Math.floor(Date.now() / 1000);
      const routeById = new Map((feed.routes || []).map((route) => [route.id, route]));
      const arrivals: LiveTramArrival[] = [];

      for (const routeGroup of data.r || []) {
        const route = routeById.get(routeGroup.id);
        const routeName = route?.d || route?.n || `Tramvay ${routeGroup.id}`;
        const lineRef = inferLineRef(routeName);

        for (const item of routeGroup.tt || []) {
          const etaSeconds = item.eta?.tt;
          if (typeof etaSeconds !== 'number' || etaSeconds < 0 || etaSeconds > 24 * 60 * 60) continue;

          if (item.pt && item.pt < serverTime - STALE_LIVE_ARRIVAL_SECONDS) {
            devLog(
              `[TramNimbus] stale arrival skipped: route=${routeGroup.id} pt=${item.pt} server=${serverTime} eta=${etaSeconds}`
            );
            continue;
          }

          const etaMinutes = Math.max(0, Math.round(etaSeconds / 60));
          const arrivalEpoch = serverTime + etaSeconds;

          arrivals.push({
            routeId: routeGroup.id,
            lineRef,
            routeName,
            etaMinutes,
            etaSeconds,
            arrivalTime: secondsToClock(arrivalEpoch),
            vehicleId: item.uid || undefined,
            source: 'nimbus',
          });
        }
      }

      arrivals.sort((a, b) => a.etaSeconds - b.etaSeconds);

      return {
        nimbusStopId: matchedStop.stop.id,
        nimbusStopName: matchedStop.stop.n,
        matchedDistanceMeters: matchedStop.distance,
        arrivals: arrivals.slice(0, limit),
      };
    } catch (error) {
      devLog('[TramNimbus] live arrivals failed', error);
      return null;
    }
  }

  private async fetchFeed(): Promise<NimbusFeedResponse | null> {
    if (this.feedCache && Date.now() - this.feedCache.fetchedAt < FEED_CACHE_TTL_MS) {
      return this.feedCache.data;
    }

    if (!this.feedPromise) {
      this.feedPromise = this.fetchFeedFromNetwork().finally(() => {
        this.feedPromise = null;
      });
    }

    return this.feedPromise;
  }

  private async fetchFeedFromNetwork(): Promise<NimbusFeedResponse | null> {
    try {
      const response = await fetch(`${this.baseUrl}/${this.locatorHash}/data`);
      if (!response.ok) {
        devLog(`[TramNimbus] data failed: ${response.status}`);
        return null;
      }

      const data = (await response.json()) as NimbusFeedResponse;
      this.feedCache = { data, fetchedAt: Date.now() };
      return data;
    } catch (error) {
      devLog('[TramNimbus] data fetch failed', error);
      return null;
    }
  }

  private findNearestNimbusStop(
    feed: NimbusFeedResponse,
    stop: TramStop
  ): { stop: NimbusStop; distance: number } | null {
    let nearest: { stop: NimbusStop; distance: number } | null = null;

    for (const item of feed.stops || []) {
      if (item.tp !== 4) continue;

      const coordinates = nimbusStopCoordinates(item);
      if (!coordinates) continue;

      const distance = calculateHaversineDistance(stop.coordinates, coordinates);
      if (!nearest || distance < nearest.distance) {
        nearest = { stop: item, distance };
      }
    }

    if (!nearest || nearest.distance > STOP_MATCH_MAX_DISTANCE_METERS) {
      return null;
    }

    return nearest;
  }
}

export const tramNimbusService = new TramNimbusService();
export default tramNimbusService;
