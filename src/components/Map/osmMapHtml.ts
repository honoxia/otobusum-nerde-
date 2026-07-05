import { LEAFLET_CSS, LEAFLET_JS } from './leafletAssets';
import { MAP_CONFIG } from '../../utils/constants';

interface BuildOsmHtmlParams {
  tileUrl: string;
}

/**
 * WebView içinde çalışacak Leaflet haritasının tam HTML'ini üretir.
 * Leaflet CSS/JS inline gömülüdür (offline-safe); sadece tile'lar network gerektirir.
 *
 * RN -> WebView köprüsü: window.updateTramData(jsonString), window.updateMapData(jsonString)
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
      min-height: 18px;
      line-height: 18px;
      text-align: center;
      box-shadow: 0 1px 3px rgba(0,0,0,0.4);
      white-space: nowrap;
      transform: translate(-50%, -50%);
    }
    .dolmus-stop {
      background: #E11D2A;
      color: #fff;
      font-size: 11px;
      font-weight: 700;
      width: 22px;
      height: 22px;
      line-height: 18px;
      border: 2px solid #fff;
      border-radius: 50%;
      text-align: center;
      box-shadow: 0 1px 3px rgba(0,0,0,0.4);
    }
    .dolmus-nearest {
      background: #111827;
      color: #fff;
      font-size: 16px;
      font-weight: 800;
      width: 30px;
      height: 30px;
      line-height: 26px;
      border: 2px solid #fff;
      border-radius: 50%;
      text-align: center;
      box-shadow: 0 2px 6px rgba(0,0,0,0.45);
    }
    .journey-marker {
      background: #111827;
      color: #fff;
      font-size: 11px;
      font-weight: 800;
      padding: 4px 7px;
      border: 2px solid #fff;
      border-radius: 14px;
      white-space: nowrap;
      box-shadow: 0 1px 4px rgba(0,0,0,0.35);
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

      var tramTracksLayer = L.layerGroup().addTo(map);
      var tramStopsLayer = L.layerGroup().addTo(map);
      var stopsLayer = L.layerGroup().addTo(map);
      var busesLayer = L.layerGroup().addTo(map);
      var userLayer = L.layerGroup().addTo(map);
      var dolmusRouteLayer = L.layerGroup().addTo(map);
      var dolmusStopsLayer = L.layerGroup().addTo(map);
      var journeyLayer = L.layerGroup().addTo(map);
      var hasZoomedToUser = false;
      var tramsRendered = false;

      map.createPane('busPane');
      map.getPane('busPane').style.zIndex = 680;

      map.on('click', function (e) {
        post({
          type: 'mapTap',
          coordinates: {
            latitude: e.latlng.lat,
            longitude: e.latlng.lng
          }
        });
      });

      function escapeHtml(str) {
        if (!str) return '';
        return String(str)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      }

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

      function renderTrams(trams, force) {
        if (tramsRendered && !force) return;
        tramTracksLayer.clearLayers();
        tramStopsLayer.clearLayers();
        if (!trams) return;

        var lines = trams.lines || [];
        for (var i = 0; i < lines.length; i++) {
          var line = lines[i];
          var paths = line.paths || [];
          for (var p = 0; p < paths.length; p++) {
            var latLngs = [];
            for (var c = 0; c < paths[p].length; c++) {
              latLngs.push([paths[p][c].latitude, paths[p][c].longitude]);
            }
            if (latLngs.length < 2) continue;

            L.polyline(latLngs, {
              color: '#fff',
              weight: 7,
              opacity: 0.88,
              lineCap: 'round',
              lineJoin: 'round',
              interactive: false
            }).addTo(tramTracksLayer);

            var rail = L.polyline(latLngs, {
              color: line.color || '#E11D48',
              weight: 4,
              opacity: 0.9,
              lineCap: 'round',
              lineJoin: 'round'
            });
            rail.bindTooltip(escapeHtml((line.ref ? line.ref + ' - ' : '') + line.name), {
              sticky: true
            });
            rail.addTo(tramTracksLayer);
          }
        }

        var stops = trams.stops || [];
        for (var s = 0; s < stops.length; s++) {
          var stop = stops[s];
          var marker = L.circleMarker([stop.coordinates.latitude, stop.coordinates.longitude], {
            radius: 5,
            color: '#fff',
            weight: 2,
            fillColor: '#E11D48',
            fillOpacity: 0.95
          });
          var linesText = stop.lines && stop.lines.length ? '<br/><strong>' + escapeHtml(stop.lines.join(', ')) + '</strong>' : '';
          marker.bindTooltip(escapeHtml(stop.name) + linesText, { direction: 'top' });
          marker.addTo(tramStopsLayer);
        }

        tramsRendered = true;
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
          marker.bindTooltip(escapeHtml(stop.name), { direction: 'top' });
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
          if (!bus.coordinates || !isFinite(bus.coordinates.latitude) || !isFinite(bus.coordinates.longitude)) continue;
          var icon = L.divIcon({
            className: '',
            html: '<div class="bus-marker">' + escapeHtml(bus.line) + '</div>',
            iconSize: [1, 1],
            iconAnchor: [0, 0]
          });
          var marker = L.marker([bus.coordinates.latitude, bus.coordinates.longitude], {
            icon: icon,
            pane: 'busPane',
            zIndexOffset: 1000
          });
          (function (deviceId) {
            marker.on('click', function () {
              post({ type: 'busPress', deviceId: deviceId });
            });
          })(bus.deviceId);
          marker.addTo(busesLayer);
        }
      }

      // Tek bir dolmuş hattını çiz: yola oturmuş rota çizgisi + numaralı duraklar
      function renderDolmus(d) {
        dolmusRouteLayer.clearLayers();
        dolmusStopsLayer.clearLayers();
        if (!d) return;

        var path = d.path || [];
        var latLngs = [];
        for (var i = 0; i < path.length; i++) {
          latLngs.push([path[i].latitude, path[i].longitude]);
        }
        if (latLngs.length >= 2) {
          // Beyaz dış hat (casing) + renkli rota
          L.polyline(latLngs, {
            color: '#fff', weight: 8, opacity: 0.9,
            lineCap: 'round', lineJoin: 'round', interactive: false
          }).addTo(dolmusRouteLayer);
          L.polyline(latLngs, {
            color: d.color || '#E11D2A', weight: 5, opacity: 0.95,
            lineCap: 'round', lineJoin: 'round', interactive: false
          }).addTo(dolmusRouteLayer);
        }

        var stops = d.waypoints || [];
        for (var s = 0; s < stops.length; s++) {
          var st = stops[s];
          if (!st.coordinates) continue;
          var icon = L.divIcon({
            className: '',
            html: '<div class="dolmus-stop">' + (s + 1) + '</div>',
            iconSize: null
          });
          var marker = L.marker([st.coordinates.latitude, st.coordinates.longitude], { icon: icon });
          var min = (st.minutesFromStart !== null && st.minutesFromStart !== undefined)
            ? (' (' + st.minutesFromStart + ' dk)') : '';
          marker.bindTooltip(escapeHtml(st.name) + min, { direction: 'top' });
          marker.addTo(dolmusStopsLayer);
        }

        if (d.nearestPoint) {
          var nearestIcon = L.divIcon({
            className: '',
            html: '<div class="dolmus-nearest">⌖</div>',
            iconSize: null
          });
          var nearestMarker = L.marker([d.nearestPoint.latitude, d.nearestPoint.longitude], { icon: nearestIcon });
          nearestMarker.bindTooltip('Sana en yakın rota noktası', { direction: 'top' });
          nearestMarker.addTo(dolmusStopsLayer);
        }

        if (latLngs.length >= 2) {
          try {
            map.fitBounds(L.polyline(latLngs).getBounds(), { padding: [30, 30] });
          } catch (e) {}
        }
      }

      window.updateDolmusData = function (jsonString) {
        try {
          var data = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
          renderDolmus(data);
        } catch (e) {
          post({ type: 'error', message: 'updateDolmusData failed: ' + e.message });
        }
      };

      window.updateMapData = function (jsonString) {
        try {
          var data = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
          if (data.trams && !tramsRendered) renderTrams(data.trams);
          renderStops(data.stops, data.nearestStopId);
          renderBuses(data.buses);
          renderUser(data.userLocation);
        } catch (e) {
          post({ type: 'error', message: 'updateMapData failed: ' + e.message });
        }
      };

      window.updateTramData = function (jsonString) {
        try {
          var data = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
          renderTrams(data);
        } catch (e) {
          post({ type: 'error', message: 'updateTramData failed: ' + e.message });
        }
      };

      function toLatLngs(coords) {
        var latLngs = [];
        for (var c = 0; c < coords.length; c++) {
          latLngs.push([coords[c].latitude, coords[c].longitude]);
        }
        return latLngs;
      }

      async function roadSnapBusLatLngs(coords) {
        if (!coords || coords.length < 2) return toLatLngs(coords || []);
        try {
          var coordStr = coords
            .map(function (p) { return p.longitude + ',' + p.latitude; })
            .join(';');
          var url = 'https://router.project-osrm.org/route/v1/driving/' +
            coordStr +
            '?overview=full&geometries=geojson&continue_straight=false';
          var response = await fetch(url);
          if (!response.ok) return toLatLngs(coords);
          var data = await response.json();
          var geometry = data && data.routes && data.routes[0] && data.routes[0].geometry;
          if (!geometry || !geometry.coordinates || geometry.coordinates.length < 2) return toLatLngs(coords);
          return geometry.coordinates.map(function (p) { return [p[1], p[0]]; });
        } catch (e) {
          return toLatLngs(coords);
        }
      }

      async function renderJourney(journey) {
        journeyLayer.clearLayers();
        if (!journey || !journey.legs) return;

        var bounds = [];
        for (var i = 0; i < journey.legs.length; i++) {
          var leg = journey.legs[i];
          var coords = leg.coordinates || [];
          if (coords.length < 2) continue;

          var latLngs = leg.type === 'transit' && leg.mode === 'bus'
            ? await roadSnapBusLatLngs(coords)
            : toLatLngs(coords);

          for (var c = 0; c < latLngs.length; c++) {
            bounds.push(latLngs[c]);
          }

          var color = '#111827';
          if (leg.type === 'transit') {
            color = leg.mode === 'tram' ? '#4F46E5' : leg.mode === 'dolmus' ? '#F97316' : '#22C55E';
          }

          L.polyline(latLngs, {
            color: color,
            weight: leg.type === 'walk' ? 3 : 5,
            opacity: 0.9,
            dashArray: leg.type === 'walk' ? '6,8' : null,
            lineCap: 'round',
            lineJoin: 'round'
          }).addTo(journeyLayer);

          if (leg.type === 'transit') {
            var icon = L.divIcon({
              className: '',
              html: '<div class="journey-marker">' + escapeHtml(leg.line) + '</div>',
              iconSize: null
            });
            L.marker(latLngs[0], { icon: icon }).addTo(journeyLayer);
          }
        }

        if (bounds.length >= 2) {
          try {
            map.fitBounds(L.latLngBounds(bounds), { padding: [35, 35] });
          } catch (e) {}
        }
      }

      window.updateJourneyData = function (jsonString) {
        try {
          var data = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
          renderJourney(data);
        } catch (e) {
          post({ type: 'error', message: 'updateJourneyData failed: ' + e.message });
        }
      };

      post({ type: 'ready' });
    })();
    true;
  </script>
</body>
</html>`;
}
