import { Coordinates } from '../../types/shared-types';

export type TransitGraphMode = 'bus' | 'tram' | 'dolmus';
export type TransitGraphSource = 'asis' | 'osm' | 'static';
export type TransitServiceId = 'weekday' | 'saturday' | 'sunday';

export interface TransitGraphMetadata {
  version: '1.1-phase-a';
  generatedAt: string;
  sources: TransitGraphSource[];
}

export interface TransitGraphStop {
  id: string;
  sourceId?: number | string;
  source: TransitGraphSource;
  mode: TransitGraphMode;
  name: string;
  coordinates: Coordinates;
  lines: string[];
}

export interface TransitGraphRoute {
  id: string;
  mode: TransitGraphMode;
  line: string;
  color?: string;
  source: TransitGraphSource;
}

export interface TransitGraphPattern {
  id: string;
  routeId: string;
  mode: TransitGraphMode;
  line: string;
  directionKey: string;
  directionName?: string;
  source: TransitGraphSource;
  sourceRouteIds: Array<number | string>;
  stopIds: string[];
  segmentMeters?: number[];
  /** Measured minutes from first departure stop, aligned with stopIds; null where unmeasured. */
  stopOffsetsMin?: Array<number | null>;
  shapeId?: string;
  scheduleIds?: string[];
  defaultWaitMin?: number;
}

export interface TransitTransfer {
  fromStopId: string;
  toStopId: string;
  distanceMeters: number;
  walkMin: number;
}

export interface TransitGraphCore {
  metadata: TransitGraphMetadata;
  stops: TransitGraphStop[];
  routes: TransitGraphRoute[];
  patterns: TransitGraphPattern[];
  transfers: TransitTransfer[];
}

export interface TransitGraphShape {
  id: string;
  patternId: string;
  coordinates: Coordinates[];
}

export interface TransitGraphShapes {
  metadata: Pick<TransitGraphMetadata, 'version' | 'generatedAt'>;
  shapes: TransitGraphShape[];
}

export interface TransitFrequency {
  id: string;
  patternId: string;
  serviceId: TransitServiceId;
  startMin: number;
  endMin: number;
  headwayMin: number;
}

export interface TransitDepartureSchedule {
  id: string;
  patternId: string;
  serviceId: TransitServiceId;
  sourceRouteId?: number | string;
  departureMins: number[];
}

export interface TransitGraphSchedules {
  metadata: Pick<TransitGraphMetadata, 'version' | 'generatedAt'>;
  frequencies: TransitFrequency[];
  departures: TransitDepartureSchedule[];
}
