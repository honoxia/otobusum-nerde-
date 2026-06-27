import { LEAFLET_CSS, LEAFLET_JS } from './leafletAssets';
import { MAP_CONFIG } from '../../utils/constants';

interface BuildOsmHtmlParams {
  tileUrl: string;
}

/**
 * WebView içinde çalışacak Leaflet haritasının tam HTML'ini üretir.
 * Leaflet CSS/JS inline gömülüdür (offline-safe); sadece tile'lar network gerektirir.
 *
 * RN -> WebView köprüsü: window.updateMapData(jsonString)
 * WebView -> RN köprüsü: window.ReactNativeWebView.postMessage(JSON.stringify({...}))
 */
export function buildOsmHtml({ tileUrl }: BuildOsmHtmlParams): string {
  // İnline script'e güvenli şekilde gömülecek config
  const injected = {
    tileUrl,
    colors: MAP_CONFIG.COLORS,
    center: {
      latitude: MAP_CONFIG.INITIAL_REGION.latitude,
      longitude: MAP_CONFIG.INITIAL_REGION.longitude,
    },
    minZoom: 11,
    maxZoom: 18,
    initialZoom: 13,
  };

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <style>${LEAFLET_CSS}</style>
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; }
    #map { width: 100%; background: #e5e7eb; }
    .bus-marker {
      background: ${MAP_CONFIG.COLORS.BUS};
      color: #fff;
      font-size: 12px;
      font-weight: 700;
      border: 2px solid #fff;
      border-radius: 14px;
      padding: 2px 6px;
      min-width: 22px;
      text-align: center;
      box-shadow: 0 1px 3px rgba(0,0,0,0.4);
      white-space: nowrap;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>${LEAFLET_JS}</script>
  <script>
    (function () {
      var CONFIG = ${JSON.stringify(injected)};

      function post(msg) {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify(msg));
        }
      }

      var map = L.map('map', {
        center: [CONFIG.center.latitude, CONFIG.center.longitude],
        zoom: CONFIG.initialZoom,
        minZoom: CONFIG.minZoom,
        maxZoom: CONFIG.maxZoom,
        zoomControl: true,
        attributionControl: true
      });

      L.tileLayer(CONFIG.tileUrl, {
        maxZoom: CONFIG.maxZoom,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      var stopsLayer = L.layerGroup().addTo(map);
      var busesLayer = L.layerGroup().addTo(map);
      var userLayer = L.layerGroup().addTo(map);
      var hasZoomedToUser = false;

      function renderUser(userLocation) {
        userLayer.clearLayers();
        if (!userLocation) return;
        L.circleMarker([userLocation.latitude, userLocation.longitude], {
          radius: 8,
          color: '#fff',
          weight: 3,
          fillColor: CONFIG.colors.USER,
          fillOpacity: 1
        }).addTo(userLayer);

        if (!hasZoomedToUser) {
          map.setView([userLocation.latitude, userLocation.longitude], 15, { animate: true });
          hasZoomedToUser = true;
        }
      }

      function renderStops(stops, nearestStopId) {
        stopsLayer.clearLayers();
        if (!stops) return;
        for (var i = 0; i < stops.length; i++) {
          var stop = stops[i];
          var isNearest = stop.id === nearestStopId;
          var marker = L.circleMarker([stop.coordinates.latitude, stop.coordinates.longitude], {
            radius: isNearest ? 9 : 7,
            color: '#fff',
            weight: 2,
            fillColor: isNearest ? CONFIG.colors.NEAREST_STOP : CONFIG.colors.STOP,
            fillOpacity: 1
          });
          marker.bindTooltip(stop.name, { direction: 'top' });
          (function (stopId) {
            marker.on('click', function () {
              post({ type: 'stopPress', stopId: stopId });
            });
          })(stop.id);
          marker.addTo(stopsLayer);
        }
      }

      function renderBuses(buses) {
        busesLayer.clearLayers();
        if (!buses) return;
        for (var i = 0; i < buses.length; i++) {
          var bus = buses[i];
          if (!bus.line || bus.line === 'Unknown') continue;
          var icon = L.divIcon({
            className: '',
            html: '<div class="bus-marker">' + bus.line + '</div>',
            iconSize: null
          });
          var marker = L.marker([bus.coordinates.latitude, bus.coordinates.longitude], { icon: icon });
          (function (deviceId) {
            marker.on('click', function () {
              post({ type: 'busPress', deviceId: deviceId });
            });
          })(bus.deviceId);
          marker.addTo(busesLayer);
        }
      }

      window.updateMapData = function (jsonString) {
        try {
          var data = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
          renderStops(data.stops, data.nearestStopId);
          renderBuses(data.buses);
          renderUser(data.userLocation);
        } catch (e) {
          post({ type: 'error', message: 'updateMapData failed: ' + e.message });
        }
      };

      post({ type: 'ready' });
    })();
    true;
  </script>
</body>
</html>`;
}
