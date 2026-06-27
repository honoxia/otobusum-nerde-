import { Coordinates, DolmusWaypoint } from '../types/shared-types';
import { calculateHaversineDistance } from './geo.utils';

export interface NearestPathPoint {
  index: number;
  point: Coordinates;
  distanceMeters: number;
  cumulativeMeters: number;
}

interface ProjectedPoint {
  x: number;
  y: number;
}

function toProjected(point: Coordinates, origin: Coordinates): ProjectedPoint {
  const metersPerDegreeLat = 111_320;
  const metersPerDegreeLon = 111_320 * Math.cos((origin.latitude * Math.PI) / 180);

  return {
    x: (point.longitude - origin.longitude) * metersPerDegreeLon,
    y: (point.latitude - origin.latitude) * metersPerDegreeLat,
  };
}

function fromProjected(point: ProjectedPoint, origin: Coordinates): Coordinates {
  const metersPerDegreeLat = 111_320;
  const metersPerDegreeLon = 111_320 * Math.cos((origin.latitude * Math.PI) / 180);

  return {
    latitude: origin.latitude + point.y / metersPerDegreeLat,
    longitude: origin.longitude + point.x / metersPerDegreeLon,
  };
}

function pathCumulativeDistances(path: Coordinates[]): number[] {
  const distances = [0];
  for (let i = 1; i < path.length; i += 1) {
    distances.push(distances[i - 1] + calculateHaversineDistance(path[i - 1], path[i]));
  }
  return distances;
}

export function nearestPointOnPath(user: Coordinates, path: Coordinates[]): NearestPathPoint | null {
  if (path.length === 0) return null;
  if (path.length === 1) {
    return {
      index: 0,
      point: path[0],
      distanceMeters: calculateHaversineDistance(user, path[0]),
      cumulativeMeters: 0,
    };
  }

  const cumulative = pathCumulativeDistances(path);
  const projectedUser = toProjected(user, user);
  let best: NearestPathPoint | null = null;

  for (let i = 0; i < path.length - 1; i += 1) {
    const segmentStart = path[i];
    const segmentEnd = path[i + 1];
    const a = toProjected(segmentStart, user);
    const b = toProjected(segmentEnd, user);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const segmentLengthSq = dx * dx + dy * dy;
    const rawT =
      segmentLengthSq === 0
        ? 0
        : ((projectedUser.x - a.x) * dx + (projectedUser.y - a.y) * dy) / segmentLengthSq;
    const t = Math.max(0, Math.min(1, rawT));
    const projectedPoint = {
      x: a.x + t * dx,
      y: a.y + t * dy,
    };
    const point = fromProjected(projectedPoint, user);
    const distanceMeters = calculateHaversineDistance(user, point);
    const segmentMeters = calculateHaversineDistance(segmentStart, segmentEnd);
    const cumulativeMeters = cumulative[i] + segmentMeters * t;

    if (!best || distanceMeters < best.distanceMeters) {
      best = {
        index: i,
        point,
        distanceMeters,
        cumulativeMeters,
      };
    }
  }

  return best;
}

export function minutesAtCumulative(
  cumulativeMeters: number,
  path: Coordinates[],
  waypoints: DolmusWaypoint[]
): number | null {
  const timedWaypoints = waypoints
    .filter((waypoint) => waypoint.coordinates)
    .map((waypoint) => {
      const nearest = nearestPointOnPath(waypoint.coordinates as Coordinates, path);
      return nearest
        ? {
            cumulativeMeters: nearest.cumulativeMeters,
            minutesFromStart: waypoint.minutesFromStart,
          }
        : null;
    })
    .filter((waypoint): waypoint is { cumulativeMeters: number; minutesFromStart: number } => !!waypoint)
    .sort((a, b) => a.cumulativeMeters - b.cumulativeMeters);

  if (timedWaypoints.length === 0) return null;
  if (timedWaypoints.length === 1) return timedWaypoints[0].minutesFromStart;
  if (cumulativeMeters <= timedWaypoints[0].cumulativeMeters) return timedWaypoints[0].minutesFromStart;

  const last = timedWaypoints[timedWaypoints.length - 1];
  if (cumulativeMeters >= last.cumulativeMeters) return last.minutesFromStart;

  for (let i = 0; i < timedWaypoints.length - 1; i += 1) {
    const current = timedWaypoints[i];
    const next = timedWaypoints[i + 1];
    if (cumulativeMeters >= current.cumulativeMeters && cumulativeMeters <= next.cumulativeMeters) {
      const distanceSpan = next.cumulativeMeters - current.cumulativeMeters;
      if (distanceSpan <= 0) return current.minutesFromStart;

      const t = (cumulativeMeters - current.cumulativeMeters) / distanceSpan;
      return current.minutesFromStart + (next.minutesFromStart - current.minutesFromStart) * t;
    }
  }

  return null;
}
