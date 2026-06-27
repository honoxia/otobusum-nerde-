import React, { useRef, useMemo, useCallback, useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { Coordinates, BusStop, BusPosition } from '../../types/shared-types';
import { config } from '../../config';
import { buildOsmHtml } from './osmMapHtml';

interface OsmMapViewProps {
  userLocation: Coordinates | null;
  stops: BusStop[];
  nearestStopId?: string | null;
  buses?: BusPosition[];
  onStopPress?: (stop: BusStop) => void;
  onBusPress?: (bus: BusPosition) => void;
  // WebView yüklenemezse MapContainer'ın liste moduna düşmesi için
  onError?: () => void;
}

/**
 * OpenStreetMap + Leaflet tabanlı harita (WebView içinde).
 * Google Maps API key gerektirmez. Veriler RN'den WebView'e JSON olarak gönderilir.
 */
export const OsmMapView: React.FC<OsmMapViewProps> = ({
  userLocation,
  stops,
  nearestStopId,
  buses = [],
  onStopPress,
  onBusPress,
  onError,
}) => {
  const webViewRef = useRef<WebView>(null);
  const [isReady, setIsReady] = useState(false);

  // HTML yalnızca bir kez üretilir (Leaflet inline gömülü)
  const html = useMemo(() => buildOsmHtml({ tileUrl: config.map.tileUrl }), []);

  // Güncel veriyi WebView'e gönder
  const pushData = useCallback(() => {
    const payload = JSON.stringify({ userLocation, stops, nearestStopId, buses });
    // updateMapData WebView içinde tanımlı; string'i güvenle geçir
    const script = `window.updateMapData(${JSON.stringify(payload)}); true;`;
    webViewRef.current?.injectJavaScript(script);
  }, [userLocation, stops, nearestStopId, buses]);

  // Harita hazır olduğunda veya veri değiştiğinde tekrar gönder
  useEffect(() => {
    if (isReady) pushData();
  }, [isReady, pushData]);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const msg = JSON.parse(event.nativeEvent.data);
        if (msg.type === 'ready') {
          setIsReady(true);
        } else if (msg.type === 'stopPress') {
          const stop = stops.find((s) => s.id === msg.stopId);
          if (stop) onStopPress?.(stop);
        } else if (msg.type === 'busPress') {
          const bus = buses.find((b) => b.deviceId === msg.deviceId);
          if (bus) onBusPress?.(bus);
        } else if (msg.type === 'error') {
          console.warn('[OSM]', msg.message);
        }
      } catch {
        // sessiz geç
      }
    },
    [stops, buses, onStopPress, onBusPress]
  );

  const handleError = useCallback(() => {
    console.warn('[OSM] WebView yüklenemedi, liste moduna düşülüyor');
    onError?.();
  }, [onError]);

  return (
    <WebView
      ref={webViewRef}
      style={styles.webview}
      originWhitelist={['*']}
      source={{ html }}
      javaScriptEnabled
      domStorageEnabled
      onMessage={handleMessage}
      onError={handleError}
      onHttpError={handleError}
      // Android'de donanım hızlandırma ve performans
      androidLayerType="hardware"
    />
  );
};

const styles = StyleSheet.create({
  webview: {
    flex: 1,
    backgroundColor: '#e5e7eb',
  },
});
