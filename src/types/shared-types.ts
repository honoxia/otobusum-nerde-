// ============= LOCATION =============
export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface LocationData {
  coords: Coordinates;
  timestamp: number;
  accuracy?: number;
}

// ============= STOP =============
export interface BusStop {
  id: string;
  wialonId?: number; // Nimbus/Wialon ID
  stopNo?: string; // Durak numarası (örn: "969", "2786")
  name: string;
  coordinates: Coordinates;
  lines: string[]; // Hat numaraları: ["54", "12", "77A"]
}

// ============= TRAM (Static OSM layer / no live GPS) =============
export interface TramStop {
  id: string;
  osmId: number;
  name: string;
  coordinates: Coordinates;
  lines: string[];
}

export interface TramLine {
  id: string;
  osmId: number;
  ref: string;
  name: string;
  from?: string | null;
  to?: string | null;
  color: string;
  paths: Coordinates[][];
}

export interface TramNetwork {
  source: string;
  license: string;
  generatedAt: string;
  stops: TramStop[];
  lines: TramLine[];
}

export interface NearestStopResult {
  stop: BusStop | null;
  distance: number; // meters
  allNearbyStops?: Array<{ stop: BusStop; distance: number }>;
}

// ============= BUS/VEHICLE =============
export interface BusPosition {
  deviceId: string;
  line: string;
  coordinates: Coordinates;
  speed?: number; // km/h
  heading?: number; // derece (0-360)
  routeId?: number; // MQTT'den gelen route ID (yön belirlemek için)
  timestamp: number;
}

// ============= ETA =============
export interface ETARequest {
  userLocation: Coordinates;
  line: string;
  stopId?: string;
}

export interface ScheduledArrival {
  line: string;
  direction: string;
  etaMinutes: number;
  source: 'nimbus'; // Veri kaynağı
}

export interface ETAResult {
  status: 'ok' | 'no_nearby_stop' | 'line_not_found' | 'no_vehicle_approaching' | 'error';
  etaMinutes?: number | null;
  stopName?: string;
  stopId?: string;
  line?: string;
  direction?: string; // Yön bilgisi (örn: "Batıkent yönü")
  directionFull?: string; // Tam yön bilgisi (örn: "BATIKENT - ODUNPAZARI")
  busPosition?: Coordinates;
  distance?: number; // meter
  errorMessage?: string;
  scheduledArrivals?: ScheduledArrival[]; // Nimbus'tan gelen tarifeli varış zamanları
}

// ============= REAL-TIME =============
export interface RealTimeUpdate {
  type: 'bus_position' | 'eta_update';
  timestamp: number;
  data: BusPosition | ETAResult;
}

// ============= API RESPONSE =============
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
}
