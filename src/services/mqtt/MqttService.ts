/**
 * 🚌 Wialon Nimbus Locator - Direct MQTT
 * Nimbus'un kendi topic pattern'ini kullanır
 */

import { Buffer } from 'buffer';
global.Buffer = global.Buffer || Buffer;

import mqtt from 'precompiled-mqtt';
import { BusPosition } from '../../types/shared-types';
import routesData from '../../data/routes-data.json';
import { config } from '../../config';
import nimbusService from '../NimbusService';
import routeService from '../routes/RouteService';
import { buildRoutesFromFeed, LineRoutesData } from '../../utils/buildRoutesFromFeed';
import { devLog, devWarn } from '../../utils/devLog';

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';
type VehicleUpdateCallback = (vehicle: BusPosition) => void;
type StatusCallback = (status: ConnectionStatus, error?: string) => void;

// Nimbus Locator config
const LOCATOR_HASH = config.nimbus.locatorHash;

// Nimbus topic pattern (from bundle.js)
const NIMBUS_TOPIC = `nimbus/locator/${LOCATOR_HASH}/#`;

// Nimbus Locator API - initial units fetch
const NIMBUS_LOCATOR_URL = `https://nimbus.wialon.com/locator/api/${LOCATOR_HASH}/data`;

/** MQTT payload boyut üst sınırı (DoS koruması) */
const MAX_MQTT_MESSAGE_BYTES = 256 * 1024;

// Route ID -> Line mapping (MQTT'deki r alanından hat bulmak için)
interface RouteMapping {
  line: string;
  direction: string;
}

class MqttService {
  private client: any = null;
  private vehicleCallbacks: Set<VehicleUpdateCallback> = new Set();
  private statusCallbacks: Set<StatusCallback> = new Set();
  private isConnecting = false;
  private messageCount = 0;
  private vehicleMap: Map<string, BusPosition> = new Map();
  // İsim cache - pozisyon ve isim ayrı mesajlarda gelirse
  private nameCache: Map<string, string> = new Map();
  // Route ID -> Line mapping
  private routeIdToLine: Map<number, RouteMapping> = new Map();
  // Canlı feed'den route mapping bir kez uygulandı mı?
  private feedRoutesApplied = false;

  constructor() {
    // Açılışta statik veriyle başla; canlı feed gelince applyFeedRoutes ile güncellenir
    this.rebuildRouteMapping(routesData as LineRoutesData[], 'statik');
  }

  /**
   * LineRoutesData[] (statik veya canlı feed) -> routeId -> line mapping kur.
   * Var olan haritayı temizleyip yeniden kurar; feed güncellemesi için idempotent.
   */
  private rebuildRouteMapping(data: LineRoutesData[], source: string = 'feed'): void {
    try {
      if (!Array.isArray(data) || data.length === 0) return;

      this.routeIdToLine.clear();
      let count = 0;
      data.forEach(item => {
        item.routes?.forEach(route => {
          if (route.routeId) {
            this.routeIdToLine.set(route.routeId, {
              line: item.line,
              direction: route.direction || ''
            });
            count++;
          }
        });
      });
      devLog(`[MQTT] ✅ Route mapping built: ${count} routes -> ${this.routeIdToLine.size} unique IDs (${source})`);
    } catch (error) {
      console.error('[MQTT] ❌ Route mapping build failed:', error);
    }
  }

  /**
   * Canlı Nimbus feed'inden route mapping'i (MqttService + RouteService) güncelle.
   * Feed başarısızsa/boşsa hiçbir şey yapmaz; statik veri devrede kalır.
   */
  private applyFeedRoutes(apiData: any): void {
    if (this.feedRoutesApplied) return;

    const built = buildRoutesFromFeed(apiData);
    if (!built) return;

    this.rebuildRouteMapping(built, 'canlı feed');
    routeService.applyRoutesData(built, 'canlı feed');
    this.feedRoutesApplied = true;
    devLog(`[MQTT] ✅ Runtime route mapping: canlı feed'den ${built.length} hat güncellendi`);
  }

  /**
   * Route ID'den hat bilgisini al
   */
  private getLineFromRouteId(routeId: number): string | null {
    const mapping = this.routeIdToLine.get(routeId);
    return mapping?.line || null;
  }

  /**
   * Nimbus Locator'dan başlangıç verilerini HTTP ile al
   * Web sitesinin kullandığı aynı endpoint'leri dene
   */
  private async fetchInitialUnits(): Promise<void> {
    devWarn('[NIMBUS] ========================================');
    devWarn('[NIMBUS] Fetching initial units from HTTP...');

    // Web sitesinin kullandığı endpoint'ler
    const endpoints = [
      // Ana data endpoint
      `https://nimbus.wialon.com/api/locator/${LOCATOR_HASH}/data`,
      // Alternatif formatlar
      `https://nimbus.wialon.com/locator/${LOCATOR_HASH}/data`,
      `https://nimbus.wialon.com/api/locator/${LOCATOR_HASH}`,
      // Init endpoint
      `https://nimbus.wialon.com/api/locator/${LOCATOR_HASH}/init`,
    ];

    for (const url of endpoints) {
      try {
        devWarn(`[NIMBUS] Trying: ${url}`);
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Origin': 'https://nimbus.wialon.com',
            'Referer': `https://nimbus.wialon.com/locator/${LOCATOR_HASH}/`,
          },
        });

        devWarn(`[NIMBUS] ${url} -> Status: ${response.status}`);

        if (!response.ok) {
          const text = await response.text();
          devWarn(`[NIMBUS] Response: ${text.substring(0, 200)}`);
          continue;
        }

        const text = await response.text();
        devWarn(`[NIMBUS] Raw response (first 500 chars):`);
        devWarn(text.substring(0, 500));

        try {
          const data = JSON.parse(text);
          devWarn(`[NIMBUS] ✅ Parsed JSON! Keys: ${Object.keys(data).join(', ')}`);

          // Canlı feed'de "routes" varsa route mapping'i güncelle (self-healing)
          // Not: bu veri zaten isim çekmek için indiriliyor; ek ağ maliyeti yok.
          this.applyFeedRoutes(data);

          // units array
          if (data.units && Array.isArray(data.units)) {
            devWarn(`[NIMBUS] 🎉 Found ${data.units.length} units!`);
            let sampleCount = 0;
            data.units.forEach((unit: any) => {
              if (unit.id && unit.nm) {
                this.nameCache.set(String(unit.id), unit.nm);
                if (sampleCount < 15) {
                  devWarn(`[NIMBUS] Unit: ${unit.id} -> "${unit.nm}"`);
                  sampleCount++;
                }
              }
            });
            devWarn(`[NIMBUS] ✅ Cached ${this.nameCache.size} unit names`);
            return;
          }

          // u array (kısa format)
          if (data.u && Array.isArray(data.u)) {
            devWarn(`[NIMBUS] 🎉 Found ${data.u.length} units (u array)!`);
            data.u.forEach((unit: any, idx: number) => {
              if (unit.id && unit.nm) {
                this.nameCache.set(String(unit.id), unit.nm);
                if (idx < 15) {
                  devWarn(`[NIMBUS] Unit: ${unit.id} -> "${unit.nm}"`);
                }
              }
            });
            devWarn(`[NIMBUS] ✅ Cached ${this.nameCache.size} unit names`);
            return;
          }

          // Direct array
          if (Array.isArray(data)) {
            devWarn(`[NIMBUS] 🎉 Found array with ${data.length} items`);
            data.forEach((unit: any, idx: number) => {
              if (unit.id && unit.nm) {
                this.nameCache.set(String(unit.id), unit.nm);
                if (idx < 15) {
                  devWarn(`[NIMBUS] Unit: ${unit.id} -> "${unit.nm}"`);
                }
              }
            });
            devWarn(`[NIMBUS] ✅ Cached ${this.nameCache.size} unit names`);
            return;
          }

        } catch (parseErr) {
          devWarn(`[NIMBUS] JSON parse error: ${parseErr}`);
        }

      } catch (error: any) {
        devWarn(`[NIMBUS] ❌ Fetch error: ${error.message}`);
      }
    }

    // Son çare: HTML sayfasından veri çıkarmayı dene
    try {
      devWarn('[NIMBUS] Trying to fetch HTML page for embedded data...');
      const htmlUrl = `https://nimbus.wialon.com/locator/${LOCATOR_HASH}/`;
      const htmlResponse = await fetch(htmlUrl);
      if (htmlResponse.ok) {
        const html = await htmlResponse.text();
        devWarn(`[NIMBUS] Got HTML (${html.length} chars)`);

        // Look for embedded JSON data
        // Pattern: window.__INITIAL_STATE__ = {...} or similar
        const patterns = [
          /window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});/,
          /window\.UNITS\s*=\s*(\[[\s\S]*?\]);/,
          /"units"\s*:\s*(\[[\s\S]*?\])/,
          /var\s+units\s*=\s*(\[[\s\S]*?\]);/,
        ];

        for (const pattern of patterns) {
          const match = html.match(pattern);
          if (match) {
            devWarn(`[NIMBUS] Found embedded data with pattern!`);
            try {
              const embeddedData = JSON.parse(match[1]);
              if (Array.isArray(embeddedData)) {
                embeddedData.forEach((unit: any) => {
                  if (unit.id && unit.nm) {
                    this.nameCache.set(String(unit.id), unit.nm);
                  }
                });
                devWarn(`[NIMBUS] ✅ Extracted ${this.nameCache.size} units from HTML`);
                return;
              }
            } catch (e) {
              devWarn(`[NIMBUS] Could not parse embedded data`);
            }
          }
        }
      }
    } catch (e: any) {
      devWarn(`[NIMBUS] HTML fetch error: ${e.message}`);
    }

    devWarn('[NIMBUS] ❌ Could not fetch unit names from any endpoint');
    devWarn('[NIMBUS] Will use location-based line estimation');
    devWarn('[NIMBUS] ========================================');
  }

  async connect(): Promise<void> {
    if (this.client || this.isConnecting) return;

    this.isConnecting = true;
    this.notifyStatus('connecting');

    devLog('');
    devLog('🚌 ═══════════════════════════════════════');
    devLog('🚌 NIMBUS LOCATOR MQTT MODE');
    devLog('🚌 Topic:', NIMBUS_TOPIC);
    devLog('🚌 ═══════════════════════════════════════');
    devLog('');

    // Token yalnizca locator sayfasindan alinir; env fallback'i native bundle'a
    // gizli veri gomulmesini onlemek icin bilerek kullanilmiyor.
    devLog('[MQTT] Locator public token çekiliyor...');
    let token = (await nimbusService.fetchLocatorToken()) || '';

    if (!token) {
      const message = 'Flespi token alınamadı (locator çekilemedi).';
      console.error('[MQTT] ❌', message);
      this.isConnecting = false;
      this.notifyStatus('error', message);
      return;
    }

    // Önce HTTP ile ünite isimlerini al
    await this.fetchInitialUnits();

    try {
      this.client = mqtt.connect(config.mqtt.broker, {
        username: token,
        clientId: `nimbus_${Date.now()}`,
        clean: true,
        protocolVersion: 5
      });

      this.client.on('connect', () => {
        devLog('[MQTT] ✅ Connected to Flespi!');
        this.isConnecting = false;
        this.notifyStatus('connected');

        // Nimbus topic'e abone ol (PRIMARY)
        this.client.subscribe(NIMBUS_TOPIC, { qos: 0 }, (err: any) => {
          if (err) {
            devLog('[MQTT] ❌ Subscribe to Nimbus failed:', err.message);
          } else {
            devLog('[MQTT] ✅ Subscribed to Nimbus:', NIMBUS_TOPIC);
          }
        });

        // Prod'da yalnızca Nimbus topic; geniş Flespi fallback abonelikleri dev modunda
        if (__DEV__) {
          const fallbackTopics = [
            'flespi/message/gw/channels/+/+',
            'flespi/message/gw/devices/+',
          ];

          fallbackTopics.forEach(topic => {
            this.client.subscribe(topic, { qos: 0 }, (err: any) => {
              if (!err) {
                devLog(`[MQTT] ✅ Subscribed to fallback: ${topic}`);
              }
            });
          });
        }
      });

      // Görülen topic'leri takip et
      const seenTopics = new Set<string>();

      this.client.on('message', (topic: string, message: any) => {
        this.messageCount++;
        const buffer = Buffer.isBuffer(message) ? message : Buffer.from(message);

        if (buffer.length > MAX_MQTT_MESSAGE_BYTES) {
          devWarn(`[MQTT] Mesaj atlandı: ${buffer.length} byte (limit ${MAX_MQTT_MESSAGE_BYTES})`);
          return;
        }

        const rawStr = buffer.toString();

        // Topic pattern'i kaydet (ID yerine * koy)
        const topicPattern = topic.replace(/\/\d+$/, '/*');
        if (!seenTopics.has(topicPattern)) {
          seenTopics.add(topicPattern);
          devWarn(`[MQTT] 🆕 New topic pattern: ${topicPattern}`);
          devWarn(`[MQTT] 🆕 Full topic: ${topic}`);
        }

        // İLK 20 MESAJI LOGLA
        if (this.messageCount <= 20) {
          devWarn(`\n[MSG ${this.messageCount}] ════════════════════`);
          devWarn(`[MSG ${this.messageCount}] Topic: ${topic}`);
          devWarn(`[MSG ${this.messageCount}] Size: ${rawStr.length} bytes`);
          devWarn(`[MSG ${this.messageCount}] Raw: ${rawStr.substring(0, 800)}`);

          try {
            const parsed = JSON.parse(rawStr);
            const keys = Object.keys(parsed);
            devWarn(`[MSG ${this.messageCount}] Keys: ${keys.join(', ')}`);

            // TÜM string field'ları logla
            keys.forEach(key => {
              const val = parsed[key];
              if (typeof val === 'string' && val.length > 0) {
                devWarn(`[MSG ${this.messageCount}] ${key}: "${val}"`);
              } else if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
                devWarn(`[MSG ${this.messageCount}] ${key}: ${JSON.stringify(val).substring(0, 200)}`);
              }
            });

            // Özellikle "units" veya benzeri array var mı?
            if (parsed.units) devWarn(`[MSG ${this.messageCount}] 🎉 HAS units!`);
            if (parsed.u) devWarn(`[MSG ${this.messageCount}] 🎉 HAS u!`);
            if (Array.isArray(parsed)) devWarn(`[MSG ${this.messageCount}] 🎉 IS ARRAY with ${parsed.length} items!`);

          } catch (e) {
            devWarn(`[MSG ${this.messageCount}] Not JSON, raw bytes`);
          }
          devWarn(`[MSG ${this.messageCount}] ════════════════════\n`);
        }

        this.handleMessage(topic, buffer);
      });

      this.client.on('error', (err: any) => {
        console.error('[MQTT] ❌ Error:', err.message);
        this.notifyStatus('error', err.message);
        this.isConnecting = false;
      });

      this.client.on('offline', () => {
        devLog('[MQTT] 🔴 Offline');
        this.notifyStatus('disconnected');
      });

    } catch (error: any) {
      console.error('[MQTT] ❌ Setup Error:', error.message);
      this.isConnecting = false;
    }
  }

  private handleMessage(topic: string, message: Buffer): void {
    // Her 50 mesajda özet
    if (this.messageCount % 50 === 0) {
      const vehicles = [...this.vehicleMap.values()];
      const knownLines = [...new Set(vehicles.map(v => v.line))];
      const nonUnknown = knownLines.filter(l => l !== 'Unknown');
      const unknownCount = vehicles.filter(v => v.line === 'Unknown').length;
      devWarn(`[MQTT] 📊 ${this.messageCount} msgs, ${this.vehicleMap.size} vehicles (${unknownCount} unknown)`);
      devWarn(`[MQTT] 📋 Lines (${nonUnknown.length}): ${nonUnknown.length > 0 ? nonUnknown.slice(0, 15).join(', ') : 'ALL UNKNOWN!'}`);
    }

    try {
      const parsed = JSON.parse(message.toString());

      // Array mi? (Batch message)
      if (Array.isArray(parsed)) {
        if (this.messageCount <= 5) {
          devWarn(`[MQTT] 📦 Array message with ${parsed.length} items`);
        }
        parsed.forEach(item => this.processUnit(item, topic));
        return;
      }

      // units objesi var mı? (Nimbus init response)
      if (parsed.units && Array.isArray(parsed.units)) {
        devWarn(`[MQTT] 📦 Units batch: ${parsed.units.length} units`);
        parsed.units.forEach((unit: any) => {
          // İsimleri cache'le
          if (unit.id && unit.nm) {
            this.nameCache.set(String(unit.id), unit.nm);
            if (this.nameCache.size <= 10) {
              devWarn(`[NAME CACHE] ${unit.id} -> "${unit.nm}"`);
            }
          }
          this.processUnit(unit, topic);
        });
        return;
      }

      // Tek obje
      this.processUnit(parsed, topic);

    } catch (e) {
      if (this.messageCount <= 5) {
        devWarn(`[MQTT] Parse error at msg ${this.messageCount}:`, e);
      }
    }
  }

  private processUnit(data: any, topic: string): void {
    // ID bul - Support multiple formats from yarım.md
    let id = data.id || data.uid || data.ident || data.i || data.unit_id;
    
    // Topic'ten ID çıkarma (yarım.md: nimbus/locator/{hash}/{deviceId})
    if (!id && topic.includes('nimbus/locator/')) {
      const parts = topic.split('/');
      id = parts[parts.length - 1];
    }

    if (!id) return;

    const idStr = String(id);

    // Discovery Mode Log (yarım.md): İlk kez görülen cihazları logla
    if (!this.vehicleMap.has(idStr)) {
      devLog(`[MQTT] 🆕 NEW DEVICE: ${idStr} on topic: ${topic}`);
      if (this.vehicleMap.size < 10) {
        devLog(`[MQTT]    Data keys: ${Object.keys(data).join(', ')}`);
        devLog(`[MQTT]    Sample: ${JSON.stringify(data).substring(0, 200)}`);
      }
    }

    // 🔍 DEBUG: 600200571 (23 numaralı hat) özel takip
    if (idStr === '600200571') {
      devWarn(`\n🚌🚌🚌 BUS 23 (ID: 600200571) UPDATE 🚌🚌🚌`);
      devWarn(`Data: ${JSON.stringify(data).substring(0, 500)}`);
    }

    // İsim var mı? Varsa cache'le
    let name = '';
    const nameFields = ['nm', 'name', 'n', 'label', 'title', 'unit_name', 'vehicle_name', 'bus_name', 'line_name'];
    for (const field of nameFields) {
      if (data[field]) {
        name = String(data[field]);
        this.nameCache.set(idStr, name); // Cache'e kaydet
        break;
      }
    }

    // unit objesi içinde
    if (!name && data.unit) {
      name = data.unit.nm || data.unit.name || data.unit.n || '';
      if (name) this.nameCache.set(idStr, name);
    }

    // Cache'ten al (pozisyon güncellemesi ama isim yok)
    if (!name && this.nameCache.has(idStr)) {
      name = this.nameCache.get(idStr)!;
    }

    // Topic'ten çıkar
    if (!name) {
      const topicParts = topic.split('/');
      if (topicParts.length > 3) {
        const lastPart = topicParts[topicParts.length - 1];
        // Sayısal değilse isim olabilir
        if (isNaN(Number(lastPart))) {
          name = lastPart;
        }
      }
    }

    // Konum bul
    let lat: number | undefined, lon: number | undefined;
    if (data.pos) {
      lat = data.pos.y;
      lon = data.pos.x;
    } else if (data.msg?.pos) {
      lat = data.msg.pos.y;
      lon = data.msg.pos.x;
    } else if (data.position) {
      lat = data.position.latitude || data.position.y || data.position.lat;
      lon = data.position.longitude || data.position.x || data.position.lon;
    } else {
      lat = data['position.latitude'] || data.lat || data.y;
      lon = data['position.longitude'] || data.lon || data.x;
    }

    if (!lat || !lon) return;

    // 1. Önce Route ID'den hat bulmayı dene (en güvenilir yöntem)
    // MQTT mesajında "r" alanı route ID'yi içerir (msg objesi içinde)
    let line: string | null = null;

    // Route ID'yi farklı yerlerden bul
    let routeId: number | undefined;
    if (typeof data.r === 'number') {
      routeId = data.r;
    } else if (data.msg && typeof data.msg.r === 'number') {
      routeId = data.msg.r;
    } else if (typeof data.route_id === 'number') {
      routeId = data.route_id;
    }

    // Debug: İlk 30 araç için route ID'yi logla
    if (this.vehicleMap.size < 30 && !this.vehicleMap.has(idStr)) {
      devWarn(`[MQTT] 🔍 Device ${idStr}: data.r=${data.r}, data.msg?.r=${data.msg?.r}, routeId=${routeId}`);
    }

    if (routeId) {
      line = this.getLineFromRouteId(routeId);
      if (line && this.vehicleMap.size < 30 && !this.vehicleMap.has(idStr)) {
        devWarn(`[MQTT] ✅ Route ID ${routeId} -> Hat ${line}`);
      } else if (!line && this.vehicleMap.size < 30 && !this.vehicleMap.has(idStr)) {
        devWarn(`[MQTT] ❌ Route ID ${routeId} mapping'de YOK!`);
      }
    }

    // 2. Route ID'den bulamadıysa isimden çıkarmayı dene
    if (!line) {
      line = this.extractLine(name);
    }

    // 3. Cache'ten kontrol et (eğer daha önce bulduysan)
    if (!line && this.nameCache.has(idStr)) {
      const cachedName = this.nameCache.get(idStr)!;
      // Cache'teki değer bir hat numarası mı?
      if (/^\d+[A-Z]?(-[A-Z]+)?$/i.test(cachedName)) {
        line = cachedName;
      }
    }

    // Hat bulunduysa cache'e kaydet (sonraki mesajlar için)
    if (line) {
      this.nameCache.set(idStr, line);
    }

    // Debug: Hala bulunamadıysa
    if (!line && this.vehicleMap.size < 30 && !this.vehicleMap.has(idStr)) {
      devWarn(`[MQTT] ⚠️ Hat bulunamadı: id=${idStr}, routeId=${routeId || 'N/A'}, name="${name}"`);
    }

    // İLK 20 yeni araç için detaylı log
    if (this.vehicleMap.size < 20 && !this.vehicleMap.has(idStr)) {
      devWarn(`[NEW] id=${id}, name="${name}", line="${line || 'Unknown'}", pos=(${lat.toFixed(4)},${lon.toFixed(4)})`);
    }

    const position: BusPosition = {
      deviceId: idStr,
      line: line || 'Unknown',
      coordinates: { latitude: lat, longitude: lon },
      speed: data.pos?.s || data.msg?.pos?.s || data.speed || 0,
      heading: data.pos?.c || data.msg?.pos?.c || data.course || data.heading || 0,
      routeId: routeId, // Yön belirlemek için route ID'yi sakla
      timestamp: Date.now()
    };

    this.vehicleMap.set(idStr, position);
    this.notifyVehicleUpdate(position);
  }

  private extractLine(name: string): string | null {
    if (!name) return null;

    const normalizedName = name.trim();

    // Format 1: "54S 26 ABC 123" -> "54S"
    // Format 2: "23 - Otobüs" -> "23"
    // Format 3: "16S-NÖBET" -> "16S-NÖBET"
    // Format 4: "4K-NÖBET 123" -> "4K-NÖBET"

    // Önce tire ile ayrılmış varyantları dene (4K-NÖBET gibi)
    const variantMatch = normalizedName.match(/^(\d+[A-Za-z]?-[A-Za-z]+)/i);
    if (variantMatch) {
      return variantMatch[1].toUpperCase();
    }

    // Sonra basit format (54S, 23, 16M gibi)
    const simpleMatch = normalizedName.match(/^(\d+[A-Za-z]?)/);
    if (simpleMatch) {
      return simpleMatch[1].toUpperCase();
    }

    // İsmin içinde hat numarası var mı? (örn: "Otobüs 23S")
    const innerMatch = normalizedName.match(/\b(\d+[A-Za-z]?)\b/);
    if (innerMatch) {
      return innerMatch[1].toUpperCase();
    }

    return null;
  }

  disconnect(): void {
    if (this.client) {
      this.client.end();
      this.client = null;
    }
    this.notifyStatus('disconnected');
  }

  onVehicleUpdate(callback: VehicleUpdateCallback): () => void {
    this.vehicleCallbacks.add(callback);
    return () => this.vehicleCallbacks.delete(callback);
  }

  onStatusChange(callback: StatusCallback): () => void {
    this.statusCallbacks.add(callback);
    return () => this.statusCallbacks.delete(callback);
  }

  private notifyVehicleUpdate(vehicle: BusPosition): void {
    this.vehicleCallbacks.forEach(cb => cb(vehicle));
  }

  private notifyStatus(status: ConnectionStatus, error?: string): void {
    this.statusCallbacks.forEach(cb => cb(status, error));
  }

  isConnected(): boolean {
    return this.client?.connected || false;
  }
}

export default new MqttService();
