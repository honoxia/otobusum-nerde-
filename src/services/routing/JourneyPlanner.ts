import stopsData from '../../data/stops-data.json';
import routesData from '../../data/routes-data.json';
import tramData from '../../data/tram-data.json';
import dolmusData from '../../data/dolmus-data.json';
import { config } from '../../config';
import {
  BusStop,
  Coordinates,
  DolmusLine,
  DolmusWaypoint,
  TramLine,
  TramNetwork,
  TramStop,
} from '../../types/shared-types';
import { calculateHaversineDistance } from '../../utils/geo.utils';
import { nearestPointOnPath } from '../../utils/route.utils';

export type TransitMode = 'bus' | 'tram' | 'dolmus' | 'walk';

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
  score: number;
}

interface RouteDirection {
  routeId: number;
  direction: string;
  stopIds: number[];
}

interface LineRoutes {
  line: string;
  routes: RouteDirection[];
}

interface LinePattern {
  id: string;
  mode: Exclude<TransitMode, 'walk'>;
  line: string;
  stops: JourneyStop[];
}

interface NearbyStop {
  stop: JourneyStop;
  distance: number;
}

const WALK_SPEED_M_PER_MIN = 5000 / 60;
const TRANSFER_PENALTY_MIN = 6;

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

function normalizeText(value: string): string {
  return value.toLocaleLowerCase('tr-TR');
}

class JourneyPlanner {
  private readonly stops: JourneyStop[] = [];
  private readonly patterns: LinePattern[] = [];

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

  plan(origin: Coordinates, destination: Coordinates, maxTransfers = 1): Journey[] {
    const originStops = this.nearbyStops(origin, 450, 8);
    const destinationStops = this.nearbyStops(destination, 450, 8);

    if (originStops.length === 0 || destinationStops.length === 0) {
      return [];
    }

    const journeys: Journey[] = [];
    journeys.push(...this.findDirectJourneys(origin, destination, originStops, destinationStops));

    if (maxTransfers >= 1) {
      journeys.push(...this.findOneTransferJourneys(origin, destination, originStops, destinationStops));
    }

    return journeys
      .sort((a, b) => a.score - b.score)
      .filter((journey, index, arr) => {
        const signature = this.journeySignature(journey);
        return arr.findIndex((candidate) => this.journeySignature(candidate) === signature) === index;
      })
      .slice(0, 3);
  }

  private buildIndexes(): void {
    const busStops = stopsData as BusStop[];
    const busStopByWialon = new Map<number, JourneyStop>();

    busStops.forEach((stop) => {
      if (!stop.wialonId) return;
      const journeyStop: JourneyStop = {
        id: `bus:${stop.wialonId}`,
        sourceId: stop.wialonId,
        name: stop.name,
        mode: 'bus',
        coordinates: stop.coordinates,
        lines: stop.lines,
      };
      this.stops.push(journeyStop);
      busStopByWialon.set(stop.wialonId, journeyStop);
    });

    (routesData as LineRoutes[]).forEach((lineRoutes) => {
      lineRoutes.routes.forEach((route) => {
        const stops = route.stopIds
          .map((stopId) => busStopByWialon.get(stopId))
          .filter((stop): stop is JourneyStop => !!stop);
        if (stops.length >= 2) {
          this.patterns.push({
            id: `bus:${route.routeId}`,
            mode: 'bus',
            line: lineRoutes.line,
            stops,
          });
        }
      });
    });

    const tramNetwork = tramData as TramNetwork;
    const tramStops = tramNetwork.stops.map((stop) => this.toTramStop(stop));
    this.stops.push(...tramStops);

    tramNetwork.lines.forEach((line) => {
      const orderedStops = this.orderTramStops(line, tramStops);
      if (orderedStops.length >= 2) {
        this.patterns.push({
          id: `tram:${line.id}`,
          mode: 'tram',
          line: line.ref || line.name,
          stops: orderedStops,
        });
      }
    });

    (dolmusData as DolmusLine[]).forEach((line, lineIndex) => {
      const stops = line.waypoints
        .filter((waypoint) => waypoint.coordinates)
        .map((waypoint, waypointIndex) => this.toDolmusStop(line, waypoint, lineIndex, waypointIndex));
      this.stops.push(...stops);

      if (stops.length >= 2) {
        this.patterns.push({
          id: `dolmus:${line.line}`,
          mode: 'dolmus',
          line: line.line,
          stops,
        });
      }
    });
  }

  private toTramStop(stop: TramStop): JourneyStop {
    return {
      id: `tram:${stop.id}`,
      sourceId: stop.id,
      name: stop.name,
      mode: 'tram',
      coordinates: stop.coordinates,
      lines: stop.lines,
    };
  }

  private toDolmusStop(
    line: DolmusLine,
    waypoint: DolmusWaypoint,
    lineIndex: number,
    waypointIndex: number
  ): JourneyStop {
    return {
      id: `dolmus:${lineIndex}:${waypointIndex}`,
      name: waypoint.name,
      mode: 'dolmus',
      coordinates: waypoint.coordinates as Coordinates,
      lines: [line.line],
    };
  }

  private orderTramStops(line: TramLine, stops: JourneyStop[]): JourneyStop[] {
    const path = line.paths.flat();
    if (path.length < 2) return [];

    return stops
      .filter((stop) => stop.lines.includes(line.ref))
      .map((stop) => {
        const nearest = nearestPointOnPath(stop.coordinates, path);
        return nearest ? { stop, cumulative: nearest.cumulativeMeters } : null;
      })
      .filter((entry): entry is { stop: JourneyStop; cumulative: number } => !!entry)
      .sort((a, b) => a.cumulative - b.cumulative)
      .map((entry) => entry.stop);
  }

  private nearbyStops(point: Coordinates, radiusMeters: number, fallbackLimit: number): NearbyStop[] {
    const nearby = this.stops
      .map((stop) => ({
        stop,
        distance: calculateHaversineDistance(point, stop.coordinates),
      }))
      .sort((a, b) => a.distance - b.distance);

    const withinRadius = nearby.filter((entry) => entry.distance <= radiusMeters);
    return (withinRadius.length > 0 ? withinRadius : nearby.slice(0, fallbackLimit)).slice(0, fallbackLimit);
  }

  private findDirectJourneys(
    origin: Coordinates,
    destination: Coordinates,
    originStops: NearbyStop[],
    destinationStops: NearbyStop[]
  ): Journey[] {
    const journeys: Journey[] = [];

    for (const pattern of this.patterns) {
      for (const originStop of originStops) {
        const fromIndex = pattern.stops.findIndex((stop) => stop.id === originStop.stop.id);
        if (fromIndex === -1) continue;

        for (const destinationStop of destinationStops) {
          const toIndex = pattern.stops.findIndex((stop) => stop.id === destinationStop.stop.id);
          if (toIndex === -1 || toIndex <= fromIndex) continue;

          const transitLeg = this.createTransitLeg(pattern, fromIndex, toIndex);
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
    destinationStops: NearbyStop[]
  ): Journey[] {
    const journeys: Journey[] = [];

    for (const firstPattern of this.patterns) {
      for (const originStop of originStops) {
        const fromIndex = firstPattern.stops.findIndex((stop) => stop.id === originStop.stop.id);
        if (fromIndex === -1) continue;

        const maxTransferIndex = Math.min(firstPattern.stops.length, fromIndex + 14);
        for (let transferFromIndex = fromIndex + 1; transferFromIndex < maxTransferIndex; transferFromIndex += 1) {
          const transferFrom = firstPattern.stops[transferFromIndex];

          for (const secondPattern of this.patterns) {
            if (secondPattern.id === firstPattern.id) continue;

            const transferCandidates = secondPattern.stops
              .map((stop, index) => ({
                stop,
                index,
                distance: calculateHaversineDistance(transferFrom.coordinates, stop.coordinates),
              }))
              .filter((candidate) => candidate.distance <= 250)
              .slice(0, 3);

            for (const transferTo of transferCandidates) {
              for (const destinationStop of destinationStops) {
                const toIndex = secondPattern.stops.findIndex((stop) => stop.id === destinationStop.stop.id);
                if (toIndex === -1 || toIndex <= transferTo.index) continue;

                const firstLeg = this.createTransitLeg(firstPattern, fromIndex, transferFromIndex);
                const transferWalk = this.createWalkLeg(
                  transferFrom.name,
                  transferTo.stop.name,
                  transferTo.distance,
                  [transferFrom.coordinates, transferTo.stop.coordinates]
                );
                const secondLeg = this.createTransitLeg(secondPattern, transferTo.index, toIndex);
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

  private createTransitLeg(pattern: LinePattern, fromIndex: number, toIndex: number): TransitLeg {
    const distanceMeters = distanceAlongStops(pattern.stops, fromIndex, toIndex);
    const averageSpeed = pattern.mode === 'tram' ? 24 : config.app.defaultBusSpeedKmh;
    const approxMin = roundMinutes(((distanceMeters * 1.25) / 1000 / averageSpeed) * 60);

    return {
      type: 'transit',
      mode: pattern.mode,
      line: pattern.line,
      fromStop: pattern.stops[fromIndex],
      toStop: pattern.stops[toIndex],
      numStops: toIndex - fromIndex,
      approxMin,
      coordinates: pattern.stops.slice(fromIndex, toIndex + 1).map((stop) => stop.coordinates),
    };
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
    const totalApproxMin = legs.reduce((sum, leg) => sum + leg.approxMin, 0) + transfers * TRANSFER_PENALTY_MIN;
    const walkMeters = legs.reduce((sum, leg) => (leg.type === 'walk' ? sum + leg.distanceMeters : sum), 0);

    return {
      legs,
      transfers,
      totalApproxMin: roundMinutes(totalApproxMin),
      score: totalApproxMin + walkMeters / 250,
    };
  }

  private journeySignature(journey: Journey): string {
    return journey.legs
      .map((leg) => (leg.type === 'transit' ? `${leg.mode}:${leg.line}:${leg.fromStop.id}:${leg.toStop.id}` : 'walk'))
      .join('|');
  }
}

export const journeyPlanner = new JourneyPlanner();
export default journeyPlanner;
