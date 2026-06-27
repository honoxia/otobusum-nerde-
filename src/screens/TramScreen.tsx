import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { useTheme } from '../theme';
import { config } from '../config';
import { buildOsmHtml } from '../components/Map/osmMapHtml';
import { ScreenHeader } from '../components/common/ScreenHeader';
import { useLocation } from '../hooks/useLocation';
import tramService from '../services/tram/TramService';
import { formatDistance } from '../utils/geo.utils';

interface TramScreenProps {
  onBack: () => void;
}

export const TramScreen: React.FC<TramScreenProps> = ({ onBack }) => {
  const theme = useTheme();
  const webViewRef = useRef<WebView>(null);
  const [isReady, setIsReady] = useState(false);
  const { location, error: locationError, isLoading: locationLoading } = useLocation();

  const html = useMemo(() => buildOsmHtml({ tileUrl: config.map.tileUrl }), []);
  const network = useMemo(() => tramService.getNetwork(), []);
  const nearestStop = useMemo(() => {
    if (!location) return null;
    return tramService.findNearestTramStop(location);
  }, [location]);

  const pushMapData = useCallback(() => {
    const payload = JSON.stringify({
      trams: network,
      userLocation: location,
      stops: [],
      buses: [],
    });
    webViewRef.current?.injectJavaScript(`window.updateMapData(${JSON.stringify(payload)}); true;`);
  }, [network, location]);

  useEffect(() => {
    if (isReady) pushMapData();
  }, [isReady, pushMapData]);

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'ready') {
        setIsReady(true);
      }
    } catch {}
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />
      <ScreenHeader title="Tramvay" subtitle="Statik hatlar ve en yakın durak" onBack={onBack} />

      <View style={styles.mapWrap}>
        <WebView
          ref={webViewRef}
          style={styles.webview}
          originWhitelist={['about:blank']}
          source={{ html }}
          javaScriptEnabled
          domStorageEnabled={false}
          allowFileAccess={false}
          mixedContentMode="never"
          onMessage={handleMessage}
          androidLayerType="hardware"
        />
      </View>

      <ScrollView style={styles.panel} contentContainerStyle={styles.panelContent}>
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderLight }]}>
          <Text style={[styles.cardTitle, { color: theme.colors.textPrimary }]}>En yakın tramvay durağı</Text>
          {locationLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <Text style={[styles.cardText, { color: theme.colors.textSecondary }]}>Konum alınıyor...</Text>
            </View>
          ) : locationError ? (
            <Text style={[styles.cardText, { color: theme.colors.error }]}>{locationError}</Text>
          ) : nearestStop ? (
            <>
              <Text style={[styles.stopName, { color: theme.colors.textPrimary }]}>{nearestStop.stop.name}</Text>
              <Text style={[styles.cardText, { color: theme.colors.textSecondary }]}>
                {formatDistance(nearestStop.distance)} · Hatlar: {nearestStop.stop.lines.join(', ')}
              </Text>
            </>
          ) : (
            <Text style={[styles.cardText, { color: theme.colors.textSecondary }]}>Yakın durak hesaplanamadı.</Text>
          )}
          <Text style={[styles.note, { color: theme.colors.textTertiary }]}>
            Tramvay için canlı sefer saati yok; bilgiler statik hat verisinden gösterilir.
          </Text>
        </View>

        <View style={styles.lineList}>
          {network.lines.map((line) => (
            <View
              key={line.id}
              style={[styles.lineRow, { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderLight }]}
            >
              <View style={[styles.lineSwatch, { backgroundColor: line.color || '#E11D48' }]} />
              <View style={styles.lineTextWrap}>
                <Text style={[styles.lineTitle, { color: theme.colors.textPrimary }]} numberOfLines={1}>
                  {line.ref ? `${line.ref} · ${line.name}` : line.name}
                </Text>
                <Text style={[styles.lineSubtitle, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                  {[line.from, line.to].filter(Boolean).join(' → ') || 'Tramvay hattı'}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mapWrap: {
    flex: 1,
    minHeight: 240,
  },
  webview: {
    flex: 1,
    backgroundColor: '#e5e7eb',
  },
  panel: {
    maxHeight: 330,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  panelContent: {
    padding: 12,
    gap: 10,
  },
  card: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    gap: 6,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  stopName: {
    fontSize: 18,
    fontWeight: '900',
  },
  cardText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  note: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lineList: {
    gap: 8,
  },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    gap: 10,
  },
  lineSwatch: {
    width: 10,
    alignSelf: 'stretch',
    borderRadius: 5,
  },
  lineTextWrap: {
    flex: 1,
    gap: 2,
  },
  lineTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  lineSubtitle: {
    fontSize: 12,
    fontWeight: '600',
  },
});
