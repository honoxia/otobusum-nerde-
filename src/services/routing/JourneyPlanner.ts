import graphCoreData from '../../data/transit/graph-core.json';
import schedulesData from '../../data/transit/schedules.json';
import { config } from '../../config';
import { Coordinates } from '../../types/shared-types';
import type {
  TransitDepartureSchedule,
  TransitFrequency,
  TransitGraphCore,
  TransitGraphPattern,
  TransitGraphSchedules,
  TransitServiceId,
} from '../../data/transit/types';
import { calculateHaversineDistance } from '../../utils/geo.utils';

export type TransitMode = 'bus' | 'tram' | 'dolmus' | 'walk';
export type JourneyLabel = 'fastest' | 'leastWalking' | 'tram' | 'dolmus' | 'balanced';

export interface JourneyStop {
  id: string;
  name: string;
  mode: Exclude<TransitMode, 'walk'>;
  coordinates: Coordinates;
  lines: string[];
  sourceId?: number | string;
}

export interface TransitLeg {
  type: 'transit';
  mode: Exclude<TransitMode, 'walk'>;
  line: string;
  fromStop: JourneyStop;
  toStop: JourneyStop;
  numStops: number;
  approxMin: number;
  waitMin: number;
  coordinates: Coordinates[];
}

export interface WalkLeg {
  type: 'walk';
  fromName: string;
  toName: string;
  distanceMeters: number;
  approxMin: number;
  coordinates: Coordinates[];
}

export type JourneyLeg = TransitLeg | WalkLeg;

export interface Journey {
  legs: JourneyLeg[];
  totalApproxMin: number;
  transfers: number;
  walkMeters: number;
  score: number;
  labels: JourneyLabel[];
}

interface LinePattern {
  id: string;
  mode: Exclude<TransitMode, 'walk'>;
  line: string;
  stops: JourneyStop[];
  segmentMeters?: number[];
  stopOffsetsMin?: Array<number | null>;
  scheduleIds?: string[];
  defaultWaitMin: number;
}

interface NearbyStop {
  stop: JourneyStop;
  distance: number;
}

interface PatternStopMatch {
  pattern: LinePattern;
  index: number;
}

const WALK_SPEED_M_PER_MIN = 5000 / 60;
const TRANSFER_PENALTY_MIN = 6;
const MINUTES_PER_DAY = 24 * 60;

function walkingMinutes(distanceMeters: number): number {
  return distanceMeters / WALK_SPEED_M_PER_MIN;
}

function roundMinutes(value: number): number {
  return Math.max(1, Math.round(value));
}

function distanceAlongStops(stops: JourneyStop[], fromIndex: number, toIndex: number): number {
  let total = 0;
  for (let i = fromIndex; i < toIndex; i += 1) {
    total += calculateHaversineDistance(stops[i].coordinates, stops[i + 1].coordinates);
  }
  return total;
}

function distanceAlongSegments(segmentMeters: number[] | undefined, fromIndex: number, toIndex: number): number | null {
  if (!segmentMeters || segmentMeters.length < toIndex) return null;
  return segmentMeters.slice(fromIndex, toIndex).reduce((sum, meters) => sum + meters, 0);
}

function distanceAlongCoordinates(coordinates: Coordinates[]): number {
  let total = 0;
  for (let i = 0; i < coordinates.length - 1; i += 1) {
    total += calculateHaversineDistance(coordinates[i], coordinates[i + 1]);
  }
  return total;
}

function normalizeText(value: string): string {
  return value.toLocaleLowerCase('tr-TR');
}

class JourneyPlanner {
  private readonly stops: JourneyStop[] = [];
  private readonly patterns: LinePattern[] = [];
  private readonly stopPatternIndex = new Map<string, PatternStopMatch[]>();
  private readonly transferIndex = new Map<string, NearbyStop[]>();
  private readonly frequenciesByPattern = new Map<string, TransitFrequency[]>();
  private readonly departuresByPattern = new Map<string, TransitDepartureSchedule[]>();

  constructor() {
    this.buildIndexes();
  }

  searchStops(query: string, limit = 8): JourneyStop[] {
    const normalized = normalizeText(query.trim());
    if (!normalized) return [];

    return this.stops
      .filter((stop) => normalizeText(`${stop.name} ${stop.lines.join(' ')}`).includes(normalized))
      .slice(0, limit);
  }

  plan(origin: Coordinates, destination: Coordinates, maxTransfers = 1, resultLimit = 5, now = new Date()): Journey[] {
    const originStops = this.nearbyStops(origin, 650, 12);
    const destinationStops = this.nearbyStops(destination, 650, 12);

    if (originStops.length === 0 || destinationStops.length === 0) {
      return [];
    }

    const journeys: Journey[] = [];
    journeys.push(...this.findDirectJourneys(origin, destination, originStops, destinationStops, now));

    if (maxTransfers >= 1) {
      journeys.push(...this.findOneTransferJourneys(origin, destination, originStops, destinationStops, now));
    }

    const ranked = journeys
      .sort((a, b) => a.score - b.score)
      .filter((journey, index, arr) => {
        const signature = this.journeySignature(journey);
        return arr.findIndex((candidate) => this.journeySignature(candidate) === signature) === index;
      });

    return this.labelJourneys(this.diversifyJourneys(ranked, resultLimit));
  }

  private buildIndexes(): void {
    const graphCore = graphCoreData as TransitGraphCore;
    const schedules = schedulesData as TransitGraphSchedules;
    const stopById = new Map<string, JourneyStop>();

    schedules.frequencies.forEach((frequency) => {
      const entries = this.frequenciesByPattern.get(frequency.patternId) ?? [];
      entries.push(frequency);
      this.frequenciesByPattern.set(frequency.patternId, entries);
    });

    schedules.departures.forEach((schedule) => {
      const entries = this.departuresByPattern.get(schedule.patternId) ?? [];
      entries.push(schedule);
      this.departuresByPattern.set(schedule.patternId, entries);
    });

    graphCore.stops.forEach((stop) => {
      const journeyStop: JourneyStop = {
        id: stop.id,
        sourceId: stop.sourceId,
        name: stop.name,
        mode: stop.mode,
        coordinates: stop.coordinates,
        lines: stop.lines,
      };
      this.stops.push(journeyStop);
      stopById.set(stop.id, journeyStop);
    });

    graphCore.patterns.forEach((pattern: TransitGraphPattern) => {
      const stops = pattern.stopIds
        .map((stopId) => stopById.get(stopId))
        .filter((stop): stop is JourneyStop => !!stop);

      // Keep offsets aligned with the filtered stop list, not the raw stopIds.
      const stopOffsetsMin = pattern.stopOffsetsMin
        ? pattern.stopIds
            .map((stopId, index) => ({ stopId, offset: pattern.stopOffsetsMin?.[index] ?? null }))
            .filter((entry) => stopById.has(entry.stopId))
            .map((entry) => entry.offset)
        : undefined;

      if (stops.length >= 2) {
        this.patterns.push({
          id: pattern.id,
          mode: pattern.mode,
          line: pattern.line,
          stops,
          segmentMeters: pattern.segmentMeters,
          stopOffsetsMin,
          scheduleIds: pattern.scheduleIds,
          defaultWaitMin: pattern.defaultWaitMin ?? this.defaultWaitForMode(pattern.mode),
        });
      }
    });

    graphCore.transfers.forEach((transfer) => {
      const toStop = stopById.get(transfer.toStopId);
      if (!toStop) return;

      const transfers = this.transferIndex.get(transfer.fromStopId) ?? [];
      transfers.push({ stop: toStop, distance: transfer.distanceMeters });
      this.transferIndex.set(transfer.fromStopId, transfers);
    });

    this.buildStopPatternIndex();
  }

  private defaultWaitForMode(mode: Exclude<TransitMode, 'walk'>): number {
    if (mode === 'tram') return 6;
    if (mode === 'dolmus') return 8;
    return 10;
  }

  private buildStopPatternIndex(): void {
    this.patterns.forEach((pattern) => {
      pattern.stops.forEach((stop, index) => {
        const matches = this.stopPatternIndex.get(stop.id) ?? [];
        matches.push({ pattern, index });
        this.stopPatternIndex.set(stop.id, matches);
      });
    });
  }

  private nearbyStops(point: Coordinates, radiusMeters: number, fallbackLimit: number): NearbyStop[] {
    const nearby = this.stops
      .map((stop) => ({
        stop,
        distance: calculateHaversineDistance(point, stop.coordinates),
      }))
      .sort((a, b) => a.distance - b.distance);

    const selected = new Map<string, NearbyStop>();
    const modes: JourneyStop['mode'][] = ['bus', 'tram', 'dolmus'];
    const perModeLimit = Math.max(2, Math.ceil(fallbackLimit / modes.length));

    modes.forEach((mode) => {
      const modeStops = nearby.filter((entry) => entry.stop.mode === mode);
      const withinRadius = modeStops.filter((entry) => entry.distance <= radiusMeters);
      const candidates = withinRadius.length > 0 ? withinRadius : modeStops.slice(0, 1);

      candidates.slice(0, perModeLimit).forEach((entry) => {
        selected.set(entry.stop.id, entry);
      });
    });

    nearby.slice(0, fallbackLimit).forEach((entry) => {
      if (selected.size < fallbackLimit) selected.set(entry.stop.id, entry);
    });

    return Array.from(selected.values())
      .sort((a, b) => a.distance - b.distance)
      .slice(0, fallbackLimit);
  }

  private nearbyStopsWithin(point: Coordinates, radiusMeters: number, limit: number): NearbyStop[] {
    return this.stops
      .map((stop) => ({
        stop,
        distance: calculateHaversineDistance(point, stop.coordinates),
      }))
      .filter((entry) => entry.distance <= radiusMeters)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, limit);
  }

  private findDirectJourneys(
    origin: Coordinates,
    destination: Coordinates,
    originStops: NearbyStop[],
    destinationStops: NearbyStop[],
    now: Date
  ): Journey[] {
    const journeys: Journey[] = [];
    const destinationByStopId = new Map(destinationStops.map((entry) => [entry.stop.id, entry]));

    for (const originStop of originStops) {
      const originMatches = this.stopPatternIndex.get(originStop.stop.id) ?? [];

      for (const { pattern, index: fromIndex } of originMatches) {
        for (let toIndex = fromIndex + 1; toIndex < pattern.stops.length; toIndex += 1) {
          const destinationStop = destinationByStopId.get(pattern.stops[toIndex].id);
          if (!destinationStop) continue;
          const transitLeg = this.createTransitLeg(pattern, fromIndex, toIndex, now);
          const walkToStart = this.createWalkLeg('Konumun', originStop.stop.name, originStop.distance, [
            origin,
            originStop.stop.coordinates,
          ]);
          const walkToDestination = this.createWalkLeg(destinationStop.stop.name, 'Hedef', destinationStop.distance, [
            destinationStop.stop.coordinates,
            destination,
          ]);
          const legs = [walkToStart, transitLeg, walkToDestination];
          journeys.push(this.createJourney(legs, 0));
        }
      }
    }

    return journeys;
  }

  private findOneTransferJourneys(
    origin: Coordinates,
    destination: Coordinates,
    originStops: NearbyStop[],
    destinationStops: NearbyStop[],
    now: Date
  ): Journey[] {
    const journeys: Journey[] = [];
    const destinationByStopId = new Map(destinationStops.map((entry) => [entry.stop.id, entry]));

    for (const originStop of originStops) {
      const originMatches = this.stopPatternIndex.get(originStop.stop.id) ?? [];

      for (const { pattern: firstPattern, index: fromIndex } of originMatches) {
        const maxTransferIndex = Math.min(firstPattern.stops.length, fromIndex + 14);
        for (let transferFromIndex = fromIndex + 1; transferFromIndex < maxTransferIndex; transferFromIndex += 1) {
          const transferFrom = firstPattern.stops[transferFromIndex];
          const transferCandidates = this.transferCandidatesForStop(transferFrom);

          for (const transferTo of transferCandidates) {
            const secondMatches = this.stopPatternIndex.get(transferTo.stop.id) ?? [];

            for (const { pattern: secondPattern, index: transferToIndex } of secondMatches) {
              if (secondPattern.id === firstPattern.id) continue;

              for (let toIndex = transferToIndex + 1; toIndex < secondPattern.stops.length; toIndex += 1) {
                const destinationStop = destinationByStopId.get(secondPattern.stops[toIndex].id);
                if (!destinationStop) continue;
                const firstLeg = this.createTransitLeg(firstPattern, fromIndex, transferFromIndex, now);
                const transferWalk = this.createWalkLeg(
                  transferFrom.name,
                  transferTo.stop.name,
                  transferTo.distance,
                  [transferFrom.coordinates, transferTo.stop.coordinates]
                );
                const secondLeg = this.createTransitLeg(secondPattern, transferToIndex, toIndex, now);
                const walkToStart = this.createWalkLeg('Konumun', originStop.stop.name, originStop.distance, [
                  origin,
                  originStop.stop.coordinates,
                ]);
                const walkToDestination = this.createWalkLeg(destinationStop.stop.name, 'Hedef', destinationStop.distance, [
                  destinationStop.stop.coordinates,
                  destination,
                ]);
                const legs = [walkToStart, firstLeg, transferWalk, secondLeg, walkToDestination];
                journeys.push(this.createJourney(legs, 1));
              }
            }
          }
        }
      }
    }

    return journeys;
  }

  private transferCandidatesForStop(stop: JourneyStop): NearbyStop[] {
    const graphTransfers = this.transferIndex.get(stop.id);
    if (graphTransfers && graphTransfers.length > 0) {
      return graphTransfers.slice(0, 4);
    }

    return this.nearbyStopsWithin(stop.coordinates, 250, 3);
  }

  private createTransitLeg(pattern: LinePattern, fromIndex: number, toIndex: number, now: Date): TransitLeg {
    const coordinates = this.getTransitLegCoordinates(pattern, fromIndex, toIndex);
    const distanceMeters =
      distanceAlongSegments(pattern.segmentMeters, fromIndex, toIndex) ??
      (coordinates.length > 2
        ? distanceAlongCoordinates(coordinates)
        : distanceAlongStops(pattern.stops, fromIndex, toIndex));
    const averageSpeed = pattern.mode === 'tram' ? 24 : config.app.defaultBusSpeedKmh;
    const approxMin = roundMinutes(((distanceMeters * 1.25) / 1000 / averageSpeed) * 60);
    const waitMin = this.waitMinutesForPattern(pattern, fromIndex, now);

    return {
      type: 'transit',
      mode: pattern.mode,
      line: pattern.line,
      fromStop: pattern.stops[fromIndex],
      toStop: pattern.stops[toIndex],
      numStops: toIndex - fromIndex,
      approxMin,
      waitMin,
      coordinates,
    };
  }

  private waitMinutesForPattern(pattern: LinePattern, fromIndex: number, now: Date): number {
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const serviceId = this.serviceIdForDate(now);
    // Terminal departure times are shifted by the measured travel time to the boarding stop.
    const boardingOffsetMin = pattern.stopOffsetsMin?.[fromIndex] ?? 0;
    const departureWait = this.waitMinutesFromDepartures(pattern.id, serviceId, nowMin, boardingOffsetMin);
    if (departureWait !== null) return departureWait;

    const frequencyWait = this.waitMinutesFromFrequencies(pattern.id, serviceId, nowMin);
    if (frequencyWait !== null) return frequencyWait;

    return pattern.defaultWaitMin;
  }

  private serviceIdForDate(date: Date): TransitServiceId {
    const day = date.getDay();
    if (day === 0) return 'sunday';
    if (day === 6) return 'saturday';
    return 'weekday';
  }

  private waitMinutesFromDepartures(
    patternId: string,
    serviceId: TransitServiceId,
    nowMin: number,
    boardingOffsetMin = 0
  ): number | null {
    const schedules = this.departuresByPattern.get(patternId) ?? [];
    const schedule = schedules.find((entry) => entry.serviceId === serviceId) ?? schedules.find((entry) => entry.serviceId === 'weekday');
    if (!schedule || schedule.departureMins.length === 0) return null;

    const arrivalsAtStop = schedule.departureMins.map((minute) => minute + boardingOffsetMin);
    const nextToday = arrivalsAtStop.find((minute) => minute >= nowMin);
    const nextArrival = nextToday ?? arrivalsAtStop[0] + MINUTES_PER_DAY;
    return Math.max(0, Math.round(nextArrival - nowMin));
  }

  private waitMinutesFromFrequencies(patternId: string, serviceId: TransitServiceId, nowMin: number): number | null {
    const frequencies = this.frequenciesByPattern.get(patternId) ?? [];
    const candidates = frequencies
      .filter((entry) => entry.serviceId === serviceId || (serviceId === 'saturday' && entry.serviceId === 'weekday'))
      .sort((a, b) => a.startMin - b.startMin);

    if (candidates.length === 0) return null;

    const active = candidates.find((entry) => nowMin >= entry.startMin && nowMin <= entry.endMin);
    if (active) return Math.max(1, Math.round(active.headwayMin / 2));

    const upcoming = candidates.find((entry) => nowMin < entry.startMin);
    if (upcoming) return Math.max(0, Math.round(upcoming.startMin - nowMin));

    return Math.max(0, Math.round(candidates[0].startMin + MINUTES_PER_DAY - nowMin));
  }

  private getTransitLegCoordinates(pattern: LinePattern, fromIndex: number, toIndex: number): Coordinates[] {
    return pattern.stops.slice(fromIndex, toIndex + 1).map((stop) => stop.coordinates);
  }

  private createWalkLeg(
    fromName: string,
    toName: string,
    distanceMeters: number,
    coordinates: Coordinates[]
  ): WalkLeg {
    return {
      type: 'walk',
      fromName,
      toName,
      distanceMeters,
      approxMin: roundMinutes(walkingMinutes(distanceMeters)),
      coordinates,
    };
  }

  private createJourney(legs: JourneyLeg[], transfers: number): Journey {
    const waitMinutes = legs.reduce((sum, leg) => (leg.type === 'transit' ? sum + leg.waitMin : sum), 0);
    const totalApproxMin = legs.reduce((sum, leg) => sum + leg.approxMin, 0) + waitMinutes + transfers * TRANSFER_PENALTY_MIN;
    const walkMeters = legs.reduce((sum, leg) => (leg.type === 'walk' ? sum + leg.distanceMeters : sum), 0);
    const modePenalty = this.modePenalty(legs);

    return {
      legs,
      transfers,
      walkMeters,
      totalApproxMin: roundMinutes(totalApproxMin),
      score: totalApproxMin + walkMeters / 220 + transfers * 2 + modePenalty,
      labels: [],
    };
  }

  private modePenalty(legs: JourneyLeg[]): number {
    const transitModes = legs
      .filter((leg): leg is TransitLeg => leg.type === 'transit')
      .map((leg) => leg.mode);

    if (transitModes.includes('tram')) return -2;
    if (transitModes.includes('dolmus')) return 1;
    return 0;
  }

  private journeySignature(journey: Journey): string {
    return journey.legs
      .map((leg) => (leg.type === 'transit' ? `${leg.mode}:${leg.line}:${leg.fromStop.id}:${leg.toStop.id}` : 'walk'))
      .join('|');
  }

  private journeyModeSignature(journey: Journey): string {
    const modes = journey.legs
      .filter((leg): leg is TransitLeg => leg.type === 'transit')
      .map((leg) => leg.mode);

    return modes.length > 0 ? modes.join('+') : 'walk';
  }

  private diversifyJourneys(journeys: Journey[], limit: number): Journey[] {
    const selected: Journey[] = [];
    const seenModes = new Set<string>();

    for (const journey of journeys) {
      const modeSignature = this.journeyModeSignature(journey);
      if (seenModes.has(modeSignature)) continue;

      selected.push(journey);
      seenModes.add(modeSignature);
      if (selected.length >= limit) return selected;
    }

    for (const journey of journeys) {
      if (selected.includes(journey)) continue;

      selected.push(journey);
      if (selected.length >= limit) return selected;
    }

    return selected;
  }

  private labelJourneys(journeys: Journey[]): Journey[] {
    if (journeys.length === 0) return journeys;

    const fastest = journeys.reduce((best, journey) =>
      journey.totalApproxMin < best.totalApproxMin ? journey : best
    );
    const leastWalking = journeys.reduce((best, journey) =>
      journey.walkMeters < best.walkMeters ? journey : best
    );

    return journeys.map((journey) => {
      const labels: JourneyLabel[] = [];
      const transitModes = journey.legs
        .filter((leg): leg is TransitLeg => leg.type === 'transit')
        .map((leg) => leg.mode);

      if (journey === fastest) labels.push('fastest');
      if (journey === leastWalking && journey !== fastest) labels.push('leastWalking');
      if (transitModes.includes('tram')) labels.push('tram');
      if (transitModes.includes('dolmus')) labels.push('dolmus');
      if (labels.length === 0) labels.push('balanced');

      return { ...journey, labels: labels.slice(0, 2) };
    });
  }
}

export const journeyPlanner = new JourneyPlanner();
export default journeyPlanner;
