import { Coordinates, DolmusLine } from '../../types/shared-types';
import {
  farthestPathIndexFromStart,
  minutesAtCumulative,
  nearestPointOnPath,
  nearestPointOnPathSection,
  nearestPointsOnPath,
  NearestPathPoint,
} from '../../utils/route.utils';

export type DolmusDayKey = 'weekday' | 'saturday' | 'sunday';

export interface DolmusLegInfo {
  label: string | null; // "Espark yönü" etc.; null when the line has no direction split
  nearest: NearestPathPoint;
  minutesList: number[];
}

export interface DolmusPassing {
  time: string;
  etaMinutes: number;
}

function dayKeyForDate(date: Date): DolmusDayKey {
  const day = date.getDay();
  if (day === 0) return 'sunday';
  if (day === 6) return 'saturday';
  return 'weekday';
}

function minutesSinceMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function formatTime(totalMinutes: number): string {
  const normalized = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

class DolmusService {
  /**
   * Per-direction nearest point + passing minutes.
   * Loop lines with directionLabels get two legs (outbound / return);
   * every other line gets a single unlabeled leg.
   */
  getLegInfos(user: Coordinates, line: DolmusLine): DolmusLegInfo[] {
    if (line.loop && line.directionLabels) {
      const splitIndex = this.findLoopSplitIndex(line);

      if (splitIndex !== null && splitIndex > 0 && splitIndex < line.path.length - 1) {
        const legs = [
          { label: line.directionLabels.outbound, fromIndex: 0, toIndex: splitIndex },
          { label: line.directionLabels.return, fromIndex: splitIndex, toIndex: line.path.length - 1 },
        ];

        const infos = legs
          .map((leg): DolmusLegInfo | null => {
            const nearest = nearestPointOnPathSection(user, line.path, leg.fromIndex, leg.toIndex);
            if (!nearest) return null;

            const minutes = minutesAtCumulative(nearest.cumulativeMeters, line.path, line.waypoints, {
              loopExtrapolate: true,
            });
            if (minutes === null) return null;

            return { label: leg.label, nearest, minutesList: [Math.round(minutes)] };
          })
          .filter((info): info is DolmusLegInfo => info !== null);

        if (infos.length > 0) return infos;
      }
    }

    // Single leg: merge every nearby pass of the path (out-and-back overlap)
    const candidates = nearestPointsOnPath(user, line.path);
    if (candidates.length === 0) return [];

    const minutesList = candidates
      .map((candidate) =>
        minutesAtCumulative(candidate.cumulativeMeters, line.path, line.waypoints, {
          loopExtrapolate: line.loop,
        })
      )
      .filter((minutes): minutes is number => minutes !== null);
    if (minutesList.length === 0) return [];

    return [
      {
        label: null,
        nearest: candidates[0],
        minutesList: [...new Set(minutesList.map((minutes) => Math.round(minutes)))],
      },
    ];
  }

  /**
   * Where the outbound leg ends on a loop: the first waypoint marked
   * 'dönüş', or geometrically the farthest point from the start.
   */
  private findLoopSplitIndex(line: DolmusLine): number | null {
    const returnWaypoint = line.waypoints.find(
      (waypoint) => waypoint.direction === 'dönüş' && waypoint.coordinates
    );
    if (returnWaypoint?.coordinates) {
      const nearest = nearestPointOnPath(returnWaypoint.coordinates, line.path);
      if (nearest) return nearest.index;
    }

    return farthestPathIndexFromStart(line.path);
  }

  getNextPassings(
    line: DolmusLine,
    minutesAtPoint: number | number[],
    now = new Date(),
    count = 3
  ): DolmusPassing[] {
    const dayKey = dayKeyForDate(now);
    const schedule = line.schedule[dayKey];
    if (!schedule) return [];

    const minutesList = Array.isArray(minutesAtPoint) ? minutesAtPoint : [minutesAtPoint];
    if (minutesList.length === 0) return [];

    const nowMinutes = minutesSinceMidnight(now);
    const seenTimes = new Set<string>();
    const passings = Object.entries(schedule)
      .flatMap(([hour, minutes]) =>
        minutes.flatMap((minute) =>
          minutesList.map((pointMinutes) => {
            const departureMinutes = Number(hour) * 60 + minute;
            const passingMinutes = departureMinutes + pointMinutes;
            return {
              time: formatTime(passingMinutes),
              etaMinutes: Math.max(0, Math.round(passingMinutes - nowMinutes)),
              absoluteMinutes: passingMinutes,
            };
          })
        )
      )
      .filter((passing) => passing.absoluteMinutes >= nowMinutes)
      .sort((a, b) => a.absoluteMinutes - b.absoluteMinutes)
      .filter((passing) => {
        // Both legs of a loop can produce the same clock time; show it once
        if (seenTimes.has(passing.time)) return false;
        seenTimes.add(passing.time);
        return true;
      })
      .slice(0, count);

    return passings.map(({ time, etaMinutes }) => ({ time, etaMinutes }));
  }
}

export const dolmusService = new DolmusService();
export default dolmusService;
