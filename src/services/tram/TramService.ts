import tramData from '../../data/tram-data.json';
import { Coordinates, TramLine, TramNetwork, TramStop } from '../../types/shared-types';
import { calculateHaversineDistance } from '../../utils/geo.utils';

export interface NearestTramStop {
  stop: TramStop;
  distance: number;
}

class TramService {
  private readonly network = tramData as TramNetwork;

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
}

export const tramService = new TramService();
export default tramService;
