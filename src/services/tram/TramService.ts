import tramData from '../../data/tram-data.json';
import tramSchedule from '../../data/tram-schedule.json';
import { Coordinates, TramLine, TramNetwork, TramStop } from '../../types/shared-types';
import { calculateHaversineDistance } from '../../utils/geo.utils';

export interface NearestTramStop {
  stop: TramStop;
  distance: number;
}

export interface TramArrivalEstimate {
  routeId: string;
  lineRef: string;
  routeName: string;
  etaMinutes: number;
  arrivalTime: string;
  offsetMinutes: number;
}

interface TramScheduleRoute {
  name: string;
  weekday: Record<string, number[]>;
  sunday: Record<string, number[]>;
}

interface TramRouteConfig {
  lineRef: string;
  from: string;
  to: string;
  displayName: string;
}

interface MeasuredRouteOffsetResult {
  hasMeasuredRoute: boolean;
  offsetMinutes: number | null;
}

interface RailEdge {
  to: number;
  meters: number;
}

interface RailGraph {
  nodes: Coordinates[];
  adjacency: RailEdge[][];
  lineStops: TramStop[];
  stopNodeById: Map<string, number>;
}

const AVERAGE_TRAM_SPEED_KMH = 20;
const DWELL_MINUTES_PER_STOP = 0.35;
const ROUTE_ON_PATH_TOLERANCE_METERS = 450;
const SAME_LINE_DETOUR_TOLERANCE_METERS = 1800;
const DEPARTURE_LOOKBACK_MINUTES = 120;

const ROUTE_CONFIG: Record<string, TramRouteConfig> = {
  '840': { lineRef: 'T10', from: 'ES-ES', to: 'KUMLUBEL', displayName: 'ES-ES - Opera - KUMLUBEL' },
  '841': { lineRef: 'T10', from: 'ES-ES', to: 'SEHIR HASTANESI', displayName: 'ES-ES - SEHIR HASTANESI' },
  '842': { lineRef: 'T3', from: 'ES-ES', to: 'OGU', displayName: 'ES-ES - OGU' },
  '843': { lineRef: 'T1', from: 'ES-ES', to: 'SSK', displayName: 'ES-ES - SSK' },
  '844': { lineRef: 'T1', from: 'ES-ES', to: 'OTOGAR', displayName: 'ES-ES - OTOGAR' },
  '845': { lineRef: '36', from: 'OGU', to: 'OTOGAR', displayName: 'OGU - Opera - OTOGAR' },
  '846': { lineRef: '36', from: 'OTOGAR', to: 'OGU', displayName: 'OTOGAR - Opera - OGU' },
  '847': { lineRef: 'T9', from: 'SSK', to: 'CAMLICA', displayName: 'SSK - CAMLICA' },
  '848': { lineRef: 'T9', from: 'CAMLICA', to: 'SSK', displayName: 'CAMLICA - SSK' },
  '849': { lineRef: 'T8', from: 'SSK', to: 'BATIKENT', displayName: 'SSK - BATIKENT' },
  '850': { lineRef: 'T8', from: 'BATIKENT', to: 'SSK', displayName: 'BATIKENT - SSK' },
  '851': { lineRef: '7', from: 'OGU', to: 'CANKAYA', displayName: 'OGU - CANKAYA' },
  '852': { lineRef: '7', from: 'CANKAYA', to: 'OGU', displayName: 'CANKAYA - OGU' },
  '853': { lineRef: '12', from: 'OGU', to: '75.YIL', displayName: 'OGU - 75.YIL' },
  '854': { lineRef: '12', from: '75.YIL', to: 'OGU', displayName: '75.YIL - OGU' },
  '855': { lineRef: 'T10', from: 'KUMLUBEL', to: 'SEHIR HASTANESI', displayName: 'KUMLUBEL - SEHIR HASTANESI' },
  '856': { lineRef: 'T10', from: 'SEHIR HASTANESI', to: 'KUMLUBEL', displayName: 'SEHIR HASTANESI - KUMLUBEL' },
  '857': { lineRef: 'T4', from: 'OGU', to: 'OTOGAR', displayName: 'OGU - OTOGAR' },
  '858': { lineRef: 'T4', from: 'OTOGAR', to: 'OGU', displayName: 'OTOGAR - OGU' },
  '859': { lineRef: 'T3', from: 'SSK', to: 'OGU', displayName: 'SSK - OGU' },
  '860': { lineRef: 'T3', from: 'OGU', to: 'SSK', displayName: 'OGU - SSK' },
  '861': { lineRef: 'T1', from: 'SSK', to: 'OTOGAR', displayName: 'SSK - OTOGAR' },
  '862': { lineRef: 'T1', from: 'OTOGAR', to: 'SSK', displayName: 'OTOGAR - SSK' },
};

function normalizeText(value: string): string {
  return value
    .toLocaleUpperCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/İ/g, 'I')
    .replace(/Ş/g, 'S')
    .replace(/Ğ/g, 'G')
    .replace(/Ü/g, 'U')
    .replace(/Ö/g, 'O')
    .replace(/Ç/g, 'C')
    .replace(/\s+/g, ' ')
    .trim();
}

const MEASURED_ROUTE_STOP_OFFSETS: Record<string, Record<string, number>> = {
  '849': {
    [normalizeText('SSK')]: 0,
    [normalizeText('Erzurum Kongresi')]: 4,
    [normalizeText('Ali Fuat Cebesoy')]: 6,
    [normalizeText('Vega Outlet')]: 8,
    [normalizeText('Baksan')]: 11,
    [normalizeText('Ulusal Egemenlik')]: 13,
    [normalizeText('Behçet Necatigil')]: 15,
    [normalizeText('Tombakzade')]: 17,
    [normalizeText('Gündüz Ökçün')]: 19,
    [normalizeText('Anıt')]: 20,
    [normalizeText('Fatih')]: 21,
    [normalizeText('19 Mayıs')]: 23,
    [normalizeText('Arıcılar')]: 25,
    [normalizeText('Batıkent')]: 27,
  },
  '850': {
    [normalizeText('Batıkent')]: 0,
    [normalizeText('Gündüz Ökçün')]: 2,
    [normalizeText('Tombakzade')]: 3,
    [normalizeText('Behçet Necatigil')]: 5,
    [normalizeText('Ulusal Egemenlik')]: 7,
    [normalizeText('Baksan')]: 9,
    [normalizeText('Vega Outlet')]: 11,
    [normalizeText('Ali Fuat Cebesoy')]: 14,
    [normalizeText('Uluönder')]: 15,
    [normalizeText('SSK')]: 21,
  },
  '861': {
    [normalizeText('SSK')]: 0,
    [normalizeText('Eczacılık')]: 1,
    [normalizeText('Hava Müzesi')]: 3,
    [normalizeText('Anadolu Üniversitesi')]: 4,
    [normalizeText('Bağlar')]: 6,
    [normalizeText('Ulus Anıtı (Gar)')]: 8,
    [normalizeText('İsmet İnönü')]: 10,
    [normalizeText('Çarşı')]: 12,
    [normalizeText('Belediye')]: 17,
    [normalizeText('Atatürk Lisesi')]: 19,
    [normalizeText('Alanönü')]: 20,
    [normalizeText('Gökmeydan')]: 22,
    [normalizeText('Odunpazarı Belediyesi')]: 24,
    [normalizeText('Yenikent')]: 26,
    [normalizeText('Baro')]: 28,
    [normalizeText('Otogar')]: 30,
  },
  '862': {
    [normalizeText('Otogar')]: 0,
    [normalizeText('Baro')]: 1,
    [normalizeText('Yenikent')]: 2,
    [normalizeText('Odunpazarı Belediyesi')]: 5,
    [normalizeText('Gökmeydan')]: 7,
    [normalizeText('Alanönü')]: 9,
    [normalizeText('Atatürk Lisesi')]: 10,
    [normalizeText('Belediye')]: 13,
    [normalizeText('Çarşı')]: 15,
    [normalizeText('İsmet İnönü')]: 18,
    [normalizeText('Ulus Anıtı (Gar)')]: 20,
    [normalizeText('Bağlar')]: 22,
    [normalizeText('Anadolu Üniversitesi')]: 24,
    [normalizeText('Hava Müzesi')]: 25,
    [normalizeText('Eczacılık')]: 27,
    [normalizeText('Uluönder')]: 28,
    [normalizeText('SSK')]: 29,
  },
};

function getMeasuredRouteOffset(routeId: string, stop: TramStop): MeasuredRouteOffsetResult {
  const routeOffsets = MEASURED_ROUTE_STOP_OFFSETS[routeId];
  if (!routeOffsets) {
    return { hasMeasuredRoute: false, offsetMinutes: null };
  }

  const offsetMinutes = routeOffsets[normalizeText(stop.name)];
  return {
    hasMeasuredRoute: true,
    offsetMinutes: offsetMinutes ?? null,
  };
}

function stopMatchesTerminal(stop: TramStop, terminal: string): boolean {
  const stopName = normalizeText(stop.name);
  const normalizedTerminal = normalizeText(terminal);

  if (normalizedTerminal === 'OGU') return stopName.includes('OSMANGAZI');
  if (normalizedTerminal === 'ES-ES') return stopName.includes('ES-ES');
  if (normalizedTerminal === 'SEHIR HASTANESI') return stopName.includes('SEHIR HASTANESI');
  if (normalizedTerminal === '75.YIL') return stopName.includes('75.YIL');
  if (normalizedTerminal === 'KUMLUBEL') return stopName.includes('KUMLUBEL');

  return stopName.includes(normalizedTerminal);
}

function minutesToClock(minutes: number): string {
  const dayMinutes = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const hour = Math.floor(dayMinutes / 60);
  const minute = dayMinutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function dateToMinutes(date: Date): number {
  return date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;
}

function getDaySchedule(route: TramScheduleRoute, date: Date): Record<string, number[]> {
  return date.getDay() === 0 ? route.sunday : route.weekday;
}

function coordinateKey(coordinates: Coordinates): string {
  return `${coordinates.latitude.toFixed(7)},${coordinates.longitude.toFixed(7)}`;
}

class TramService {
  private readonly network = tramData as TramNetwork;
  private readonly scheduleRoutes = (tramSchedule as { routes: Record<string, TramScheduleRoute> }).routes;
  private readonly railGraphsByLine = new Map<string, RailGraph>();
  private readonly distanceCache = new Map<string, number[]>();

  getNetwork(): TramNetwork {
    return this.network;
  }

  getLines(): TramLine[] {
    return this.network.lines;
  }

  findNearestTramStop(user: Coordinates): NearestTramStop | null {
    let nearest: NearestTramStop | null = null;

    for (const stop of this.network.stops) {
      const distance = calculateHaversineDistance(user, stop.coordinates);
      if (!nearest || distance < nearest.distance) {
        nearest = { stop, distance };
      }
    }

    return nearest;
  }

  getUpcomingArrivalsForStop(stop: TramStop, now = new Date(), limit = 6): TramArrivalEstimate[] {
    const arrivals: TramArrivalEstimate[] = [];

    for (const [routeId, route] of Object.entries(this.scheduleRoutes)) {
      const config = ROUTE_CONFIG[routeId];
      if (!config || !stop.lines.includes(config.lineRef)) continue;

      const offsetMinutes = this.getOffsetMinutesToStop(routeId, config, stop);
      if (offsetMinutes == null) continue;

      for (const departureMinutes of this.getUpcomingDepartures(route, now)) {
        const arrivalAbsoluteMinutes = departureMinutes + offsetMinutes;
        const etaMinutes = Math.ceil(arrivalAbsoluteMinutes - dateToMinutes(now));
        if (etaMinutes < 0) continue;

        arrivals.push({
          routeId,
          lineRef: config.lineRef,
          routeName: config.displayName,
          etaMinutes,
          arrivalTime: minutesToClock(arrivalAbsoluteMinutes),
          offsetMinutes: Math.round(offsetMinutes),
        });
      }
    }

    return arrivals.sort((a, b) => a.etaMinutes - b.etaMinutes).slice(0, limit);
  }

  getUpcomingArrivalsForNearestStop(user: Coordinates, now = new Date(), limit = 6) {
    const nearest = this.findNearestTramStop(user);
    if (!nearest) return null;

    return {
      ...nearest,
      arrivals: this.getUpcomingArrivalsForStop(nearest.stop, now, limit),
    };
  }

  private getUpcomingDepartures(route: TramScheduleRoute, now: Date): number[] {
    const todayMinutes = dateToMinutes(now);
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);

    return [
      ...this.scheduleToDepartures(getDaySchedule(route, now), 0),
      ...this.scheduleToDepartures(getDaySchedule(route, tomorrow), 1440),
    ].filter((minutes) => minutes >= todayMinutes - DEPARTURE_LOOKBACK_MINUTES);
  }

  private scheduleToDepartures(schedule: Record<string, number[]>, dayOffsetMinutes: number): number[] {
    return Object.entries(schedule)
      .flatMap(([hour, minutes]) => minutes.map((minute) => dayOffsetMinutes + Number(hour) * 60 + minute))
      .sort((a, b) => a - b);
  }

  private getOffsetMinutesToStop(routeId: string, config: TramRouteConfig, stop: TramStop): number | null {
    const measuredOffset = getMeasuredRouteOffset(routeId, stop);
    if (measuredOffset.hasMeasuredRoute) {
      return measuredOffset.offsetMinutes;
    }

    const graph = this.getRailGraph(config.lineRef);
    if (!graph) return null;

    const targetNode = graph.stopNodeById.get(stop.id);
    const startNode = this.resolveTerminalNode(graph, config.from, config.to);
    const endNode = this.resolveTerminalNode(graph, config.to, config.from);
    if (targetNode == null || startNode == null || endNode == null || startNode === endNode) return null;

    const startDistances = this.getDistances(config.lineRef, startNode, graph);
    const endDistances = this.getDistances(config.lineRef, endNode, graph);
    const routeMeters = startDistances[endNode];
    const distanceMeters = startDistances[targetNode];
    const remainingMeters = endDistances[targetNode];
    if (!Number.isFinite(routeMeters) || !Number.isFinite(distanceMeters) || !Number.isFinite(remainingMeters)) {
      return null;
    }

    const throughTargetMeters = distanceMeters + remainingMeters;
    const routeTolerance = stop.lines.includes(config.lineRef)
      ? SAME_LINE_DETOUR_TOLERANCE_METERS
      : ROUTE_ON_PATH_TOLERANCE_METERS;
    const isOnRoute = throughTargetMeters <= routeMeters + routeTolerance;
    if (!isOnRoute) return null;

    const effectiveRouteMeters = Math.max(routeMeters, throughTargetMeters);
    const travelMinutes = (distanceMeters / 1000 / AVERAGE_TRAM_SPEED_KMH) * 60;
    const stopCount = this.countStopsBeforeTarget(graph, startDistances, endDistances, effectiveRouteMeters, distanceMeters);

    return travelMinutes + stopCount * DWELL_MINUTES_PER_STOP;
  }

  private getRailGraph(lineRef: string): RailGraph | null {
    const cached = this.railGraphsByLine.get(lineRef);
    if (cached) return cached;

    const lines = this.network.lines.filter((item) => item.ref === lineRef);
    if (lines.length === 0) return null;

    const nodeIndexByKey = new Map<string, number>();
    const nodes: Coordinates[] = [];
    const adjacency: RailEdge[][] = [];

    const getNodeIndex = (coordinates: Coordinates): number => {
      const key = coordinateKey(coordinates);
      const existing = nodeIndexByKey.get(key);
      if (existing != null) return existing;

      const index = nodes.length;
      nodeIndexByKey.set(key, index);
      nodes.push(coordinates);
      adjacency.push([]);
      return index;
    };

    const addEdge = (from: number, to: number, meters: number) => {
      adjacency[from].push({ to, meters });
      adjacency[to].push({ to: from, meters });
    };

    for (const line of lines) {
      for (const path of line.paths) {
        for (let index = 1; index < path.length; index += 1) {
          const from = getNodeIndex(path[index - 1]);
          const to = getNodeIndex(path[index]);
          if (from === to) continue;

          addEdge(from, to, calculateHaversineDistance(path[index - 1], path[index]));
        }
      }
    }

    const lineStops = this.network.stops.filter((stop) => stop.lines.includes(lineRef));
    const stopNodeById = new Map<string, number>();
    for (const stop of lineStops) {
      stopNodeById.set(stop.id, this.findNearestGraphNode(stop.coordinates, nodes));
    }

    const graph = { nodes, adjacency, lineStops, stopNodeById };
    this.railGraphsByLine.set(lineRef, graph);
    return graph;
  }

  private findNearestGraphNode(coordinates: Coordinates, nodes: Coordinates[]): number {
    let nearestIndex = 0;
    let nearestDistance = Infinity;

    for (let index = 0; index < nodes.length; index += 1) {
      const distance = calculateHaversineDistance(coordinates, nodes[index]);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    }

    return nearestIndex;
  }

  private resolveTerminalNode(graph: RailGraph, terminal: string, oppositeTerminal: string): number | null {
    const terminalStop = graph.lineStops.find((stop) => stopMatchesTerminal(stop, terminal));
    if (terminalStop) return graph.stopNodeById.get(terminalStop.id) ?? null;

    const oppositeStop = graph.lineStops.find((stop) => stopMatchesTerminal(stop, oppositeTerminal));
    const oppositeNode = oppositeStop ? graph.stopNodeById.get(oppositeStop.id) : null;
    if (oppositeNode == null) return null;

    // Some OSM layers miss terminal stop nodes such as Kumlubel. In that case,
    // use the farthest reachable rail node from the known opposite terminal.
    const distances = this.dijkstra(graph, oppositeNode);
    let farthestNode: number | null = null;
    let farthestDistance = -1;

    for (let index = 0; index < distances.length; index += 1) {
      if (Number.isFinite(distances[index]) && distances[index] > farthestDistance) {
        farthestDistance = distances[index];
        farthestNode = index;
      }
    }

    return farthestNode;
  }

  private getDistances(lineRef: string, startNode: number, graph: RailGraph): number[] {
    const cacheKey = `${lineRef}:${startNode}`;
    const cached = this.distanceCache.get(cacheKey);
    if (cached) return cached;

    const distances = this.dijkstra(graph, startNode);
    this.distanceCache.set(cacheKey, distances);
    return distances;
  }

  private dijkstra(graph: RailGraph, startNode: number): number[] {
    const distances = Array(graph.nodes.length).fill(Infinity);
    const visited = new Set<number>();
    distances[startNode] = 0;

    while (visited.size < graph.nodes.length) {
      let current = -1;
      let currentDistance = Infinity;

      for (let index = 0; index < distances.length; index += 1) {
        if (!visited.has(index) && distances[index] < currentDistance) {
          current = index;
          currentDistance = distances[index];
        }
      }

      if (current < 0) break;
      visited.add(current);

      for (const edge of graph.adjacency[current]) {
        const nextDistance = currentDistance + edge.meters;
        if (nextDistance < distances[edge.to]) {
          distances[edge.to] = nextDistance;
        }
      }
    }

    return distances;
  }

  private countStopsBeforeTarget(
    graph: RailGraph,
    startDistances: number[],
    endDistances: number[],
    routeMeters: number,
    targetMeters: number
  ): number {
    let count = 0;

    for (const stop of graph.lineStops) {
      const node = graph.stopNodeById.get(stop.id);
      if (node == null) continue;

      const fromStart = startDistances[node];
      const toEnd = endDistances[node];
      if (!Number.isFinite(fromStart) || !Number.isFinite(toEnd)) continue;
      if (fromStart <= 1 || fromStart > targetMeters + ROUTE_ON_PATH_TOLERANCE_METERS) continue;
      if (fromStart + toEnd > routeMeters + ROUTE_ON_PATH_TOLERANCE_METERS) continue;

      count += 1;
    }

    return count;
  }
}

export const tramService = new TramService();
export default tramService;
