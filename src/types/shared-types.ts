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

// ============= DOLMUŞ (Static minibus / no live GPS) =============
export interface DolmusWaypoint {
  name: string;
  minutesFromStart: number; // İlk duraktan kaç dakika sonra buraya varılır
  direction: 'kalkış' | 'gidiş' | 'dönüş';
  coordinates: Coordinates | null; // null = koordinat henüz doğrulanmadı
}

// Saat -> dakikalar. Örn: { "06": [15, 29, 42, 58] }
export type DolmusDaySchedule = Record<string, number[]>;

export interface DolmusSchedule {
  weekday: DolmusDaySchedule; // Hafta içi
  saturday: DolmusDaySchedule; // Cumartesi
  sunday: DolmusDaySchedule; // Pazar
}

export interface DolmusLine {
  line: string; // "KIRMIZI 23"
  operator: string; // İşletmeci durak adı
  color: string; // Hat rengi (hex)
  firstStop: string; // Kalkış durağı adı
  loop: boolean; // Tek tur halka güzergah mı
  directionLabels?: { outbound: string; return: string }; // Halka hatta gidiş/dönüş bacağı etiketleri
  waypoints: DolmusWaypoint[]; // Sıralı güzergah noktaları (duraklar + saat referansı)
  path: Coordinates[]; // Haritaya çizilen yol geometrisi (yola oturmuş rota çizgisi)
  schedule: DolmusSchedule; // İlk duraktan hareket saatleri
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
