import { Coordinates, DolmusLine } from '../../types/shared-types';
import { minutesAtCumulative, nearestPointOnPath, NearestPathPoint } from '../../utils/route.utils';

export type DolmusDayKey = 'weekday' | 'saturday' | 'sunday';

export interface DolmusNearestInfo {
  nearest: NearestPathPoint;
  minutesAtPoint: number;
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
  getNearestInfo(user: Coordinates, line: DolmusLine): DolmusNearestInfo | null {
    const nearest = nearestPointOnPath(user, line.path);
    if (!nearest) return null;

    const minutesAtPoint = minutesAtCumulative(nearest.cumulativeMeters, line.path, line.waypoints);
    if (minutesAtPoint === null) return null;

    return {
      nearest,
      minutesAtPoint,
    };
  }

  getNextPassings(line: DolmusLine, minutesAtPoint: number, now = new Date(), count = 3): DolmusPassing[] {
    const dayKey = dayKeyForDate(now);
    const schedule = line.schedule[dayKey];
    if (!schedule) return [];

    const nowMinutes = minutesSinceMidnight(now);
    const passings = Object.entries(schedule)
      .flatMap(([hour, minutes]) =>
        minutes.map((minute) => {
          const departureMinutes = Number(hour) * 60 + minute;
          const passingMinutes = departureMinutes + minutesAtPoint;
          return {
            time: formatTime(passingMinutes),
            etaMinutes: Math.max(0, Math.round(passingMinutes - nowMinutes)),
            absoluteMinutes: passingMinutes,
          };
        })
      )
      .filter((passing) => passing.absoluteMinutes >= nowMinutes)
      .sort((a, b) => a.absoluteMinutes - b.absoluteMinutes)
      .slice(0, count);

    return passings.map(({ time, etaMinutes }) => ({ time, etaMinutes }));
  }
}

export const dolmusService = new DolmusService();
export default dolmusService;
