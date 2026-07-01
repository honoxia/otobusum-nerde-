/**
 * Nimbus canlı feed'inden ({routes:[{id,d,s}]}) uygulama içi route verisi üretir.
 * scripts/extract-routes.js ile AYNI mantık: bir route'un geçtiği durakların
 * hatlarını sayar, en sık geçen hattı (>= %50 coverage) o route'a atar.
 *
 * Amaç: ASİS sezon değişiminde route ID'lerini yeniden numaralandırınca
 * (örn. 130xxx) uygulamanın statik routes-data.json'a bağımlı kalmadan
 * kendini güncelleyebilmesi.
 */
import stopsData from '../data/stops-data.json';

/** Nimbus feed'indeki tek bir route kaydı */
interface FeedRoute {
  id: number;
  d?: string; // direction (yön metni)
  s?: number[]; // stop wialon id listesi
}

interface FeedData {
  routes?: FeedRoute[];
}

/** routes-data.json ile aynı şekil */
export interface RouteDirectionData {
  routeId: number;
  direction: string;
  stopIds: number[];
}

export interface LineRoutesData {
  line: string;
  routes: RouteDirectionData[];
}

// wialonId -> lines haritası bir kez kurulur (modül seviyesinde cache)
let stopLinesMap: Map<number, string[]> | null = null;

function getStopLinesMap(): Map<number, string[]> {
  if (stopLinesMap) return stopLinesMap;
  const map = new Map<number, string[]>();
  (stopsData as Array<{ wialonId: number; lines: string[] }>).forEach(stop => {
    map.set(stop.wialonId, stop.lines);
  });
  stopLinesMap = map;
  return map;
}

/**
 * Feed verisinden LineRoutesData[] üretir. Veri yoksa/boşsa null döner
 * (çağıran taraf statik veriye fallback yapabilsin diye).
 */
export function buildRoutesFromFeed(apiData: FeedData | null | undefined): LineRoutesData[] | null {
  if (!apiData?.routes || !Array.isArray(apiData.routes) || apiData.routes.length === 0) {
    return null;
  }

  const linesMap = getStopLinesMap();
  const lineRoutesMap: Record<string, RouteDirectionData[]> = {};

  apiData.routes.forEach(route => {
    if (!route.s || route.s.length === 0) return;

    // Route'un geçtiği durakların hatlarını say
    const freq: Record<string, number> = {};
    route.s.forEach(stopId => {
      const lines = linesMap.get(stopId);
      if (lines) {
        lines.forEach(line => {
          freq[line] = (freq[line] || 0) + 1;
        });
      }
    });

    const entries = Object.entries(freq);
    if (entries.length === 0) return;

    // En sık geçen hat
    entries.sort((a, b) => b[1] - a[1]);
    const [topLine, topCount] = entries[0];

    // En az %50 coverage şartı
    if (topCount / route.s.length < 0.5) return;

    if (!lineRoutesMap[topLine]) lineRoutesMap[topLine] = [];
    lineRoutesMap[topLine].push({
      routeId: route.id,
      direction: route.d || '',
      stopIds: route.s,
    });
  });

  const result = Object.entries(lineRoutesMap).map(([line, routes]) => ({ line, routes }));
  return result.length > 0 ? result : null;
}
