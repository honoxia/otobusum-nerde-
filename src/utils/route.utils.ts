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

function projectOnAllSegments(user: Coordinates, path: Coordinates[]): NearestPathPoint[] {
  if (path.length === 0) return [];
  if (path.length === 1) {
    return [
      {
        index: 0,
        point: path[0],
        distanceMeters: calculateHaversineDistance(user, path[0]),
        cumulativeMeters: 0,
      },
    ];
  }

  const cumulative = pathCumulativeDistances(path);
  const projectedUser = toProjected(user, user);
  const results: NearestPathPoint[] = [];

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

    results.push({ index: i, point, distanceMeters, cumulativeMeters });
  }

  return results;
}

export function nearestPointOnPath(user: Coordinates, path: Coordinates[]): NearestPathPoint | null {
  const candidates = projectOnAllSegments(user, path);
  if (candidates.length === 0) return null;

  let best = candidates[0];
  for (const candidate of candidates) {
    if (candidate.distanceMeters < best.distanceMeters) best = candidate;
  }
  return best;
}

/**
 * Nearest point of a path SECTION (segments fromIndex..toIndex-1).
 * Cumulative meters stay relative to the full path so timing lookups work.
 */
export function nearestPointOnPathSection(
  user: Coordinates,
  path: Coordinates[],
  fromIndex: number,
  toIndex: number
): NearestPathPoint | null {
  const candidates = projectOnAllSegments(user, path).filter(
    (candidate) => candidate.index >= fromIndex && candidate.index < toIndex
  );
  if (candidates.length === 0) return null;

  let best = candidates[0];
  for (const candidate of candidates) {
    if (candidate.distanceMeters < best.distanceMeters) best = candidate;
  }
  return best;
}

/**
 * Index of the path point farthest from the start; on a loop this is the
 * natural turnaround point splitting the outbound and return legs.
 */
export function farthestPathIndexFromStart(path: Coordinates[]): number | null {
  if (path.length < 2) return null;

  let bestIndex = 0;
  let bestDistance = -1;
  for (let i = 0; i < path.length; i += 1) {
    const distance = calculateHaversineDistance(path[0], path[i]);
    if (distance > bestDistance) {
      bestDistance = distance;
      bestIndex = i;
    }
  }
  return bestIndex;
}

/**
 * Finds every pass of the path near the user (a loop line can pass the same
 * street on both the outbound and return legs). Returns the closest point of
 * each distinct pass, nearest first.
 */
export function nearestPointsOnPath(
  user: Coordinates,
  path: Coordinates[],
  options: { maxCandidates?: number; extraDistanceMeters?: number; minSeparationMeters?: number } = {}
): NearestPathPoint[] {
  const { maxCandidates = 3, extraDistanceMeters = 100, minSeparationMeters = 400 } = options;

  const candidates = projectOnAllSegments(user, path).sort(
    (a, b) => a.distanceMeters - b.distanceMeters
  );
  if (candidates.length === 0) return [];

  const maxDistance = candidates[0].distanceMeters + extraDistanceMeters;
  const selected: NearestPathPoint[] = [];

  for (const candidate of candidates) {
    if (selected.length >= maxCandidates) break;
    if (candidate.distanceMeters > maxDistance) break;

    // A different pass must be well separated along the route
    const isDistinctPass = selected.every(
      (item) => Math.abs(item.cumulativeMeters - candidate.cumulativeMeters) > minSeparationMeters
    );
    if (isDistinctPass) selected.push(candidate);
  }

  return selected;
}

export function minutesAtCumulative(
  cumulativeMeters: number,
  path: Coordinates[],
  waypoints: DolmusWaypoint[],
  options: { loopExtrapolate?: boolean } = {}
): number | null {
  // Project waypoints onto the path IN ORDER: a loop can pass the same street
  // twice, and picking the globally nearest pass can land a waypoint on the
  // wrong leg (scrambling the time curve). Each waypoint must therefore sit
  // on the earliest pass that lies after the previous waypoint.
  const timedWaypoints: { cumulativeMeters: number; minutesFromStart: number }[] = [];
  let prevCumulative = -Infinity;

  const orderedWaypoints = [...waypoints]
    .filter((waypoint) => waypoint.coordinates)
    .sort((a, b) => a.minutesFromStart - b.minutesFromStart);

  for (const waypoint of orderedWaypoints) {
    const passes = nearestPointsOnPath(waypoint.coordinates as Coordinates, path);
    const forwardPasses = passes
      .filter((pass) => pass.cumulativeMeters > prevCumulative)
      .sort((a, b) => a.cumulativeMeters - b.cumulativeMeters);

    // No pass ahead of the previous waypoint: skip rather than corrupt the curve
    if (forwardPasses.length === 0) continue;

    timedWaypoints.push({
      cumulativeMeters: forwardPasses[0].cumulativeMeters,
      minutesFromStart: waypoint.minutesFromStart,
    });
    prevCumulative = forwardPasses[0].cumulativeMeters;
  }

  if (timedWaypoints.length === 0) return null;
  if (timedWaypoints.length === 1) return timedWaypoints[0].minutesFromStart;
  if (cumulativeMeters <= timedWaypoints[0].cumulativeMeters) return timedWaypoints[0].minutesFromStart;

  const last = timedWaypoints[timedWaypoints.length - 1];
  if (cumulativeMeters >= last.cumulativeMeters) {
    // On a loop line the vehicle keeps moving back toward the first stop;
    // extend past the last timed waypoint using the average pace so the
    // tail of the loop does not get a flat (too early) time.
    if (options.loopExtrapolate) {
      const first = timedWaypoints[0];
      const distanceSpan = last.cumulativeMeters - first.cumulativeMeters;
      if (distanceSpan > 0) {
        const minutesPerMeter = (last.minutesFromStart - first.minutesFromStart) / distanceSpan;
        return last.minutesFromStart + (cumulativeMeters - last.cumulativeMeters) * minutesPerMeter;
      }
    }
    return last.minutesFromStart;
  }

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
