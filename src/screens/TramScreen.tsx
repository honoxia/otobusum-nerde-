import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { config } from '../config';
import { buildOsmHtml } from '../components/Map/osmMapHtml';
import { ScreenHeader } from '../components/common/ScreenHeader';
import { useLocation } from '../hooks/useLocation';
import tramService from '../services/tram/TramService';
import tramNimbusService, { LiveTramStopArrivals } from '../services/tram/TramNimbusService';
import { formatDistance } from '../utils/geo.utils';

interface TramScreenProps {
  onBack: () => void;
}

const offsetSourceLabels = {
  measured: 'measured',
  'fixed-interval': 'fixed-interval',
} as const;

interface TramDisplayArrival {
  key: string;
  routeName: string;
  lineRef: string;
  arrivalTime: string;
  etaMinutes: number;
  metaLabel: string;
}

export const TramScreen: React.FC<TramScreenProps> = ({ onBack }) => {
  const theme = useTheme();
  const webViewRef = useRef<WebView>(null);
  const [isReady, setIsReady] = useState(false);
  const [liveStopArrivals, setLiveStopArrivals] = useState<LiveTramStopArrivals | null>(null);
  const [liveChecked, setLiveChecked] = useState(false);
  const { location, error: locationError, isLoading: locationLoading } = useLocation();

  const html = useMemo(() => buildOsmHtml({ tileUrl: config.map.tileUrl }), []);
  const network = useMemo(() => tramService.getNetwork(), []);
  const nearestStop = useMemo(() => {
    if (!location) return null;
    return tramService.getUpcomingArrivalsForNearestStop(location);
  }, [location]);
  const visibleLines = useMemo(() => {
    if (!nearestStop?.stop.lines.length) return network.lines;

    return network.lines.filter((line) => nearestStop.stop.lines.includes(line.ref));
  }, [nearestStop, network.lines]);
  const displayArrivals = useMemo<TramDisplayArrival[]>(() => {
    if (liveStopArrivals?.arrivals.length) {
      return liveStopArrivals.arrivals.map((arrival) => ({
        key: `nimbus-${arrival.routeId}-${arrival.arrivalTime}-${arrival.etaMinutes}`,
        routeName: arrival.routeName,
        lineRef: arrival.lineRef,
        arrivalTime: arrival.arrivalTime,
        etaMinutes: arrival.etaMinutes,
        metaLabel: 'Canlı Nimbus',
      }));
    }

    return (nearestStop?.arrivals || []).map((arrival) => ({
      key: `schedule-${arrival.routeId}-${arrival.arrivalTime}-${arrival.etaMinutes}`,
      routeName: arrival.routeName,
      lineRef: arrival.lineRef,
      arrivalTime: arrival.arrivalTime,
      etaMinutes: arrival.etaMinutes,
      metaLabel: offsetSourceLabels[arrival.offsetSource],
    }));
  }, [liveStopArrivals, nearestStop]);
  const hasLiveArrivals = Boolean(liveStopArrivals?.arrivals.length);
  const primaryArrival = displayArrivals[0];
  const nextArrivals = displayArrivals.slice(1, 4);

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

  useEffect(() => {
    let isCancelled = false;
    let intervalId: NodeJS.Timeout | null = null;

    const loadLiveArrivals = async () => {
      if (!nearestStop) {
        setLiveStopArrivals(null);
        setLiveChecked(false);
        return;
      }

      const result = await tramNimbusService.getLiveArrivalsForStop(nearestStop.stop);
      if (isCancelled) return;

      setLiveStopArrivals(result);
      setLiveChecked(true);
    };

    setLiveStopArrivals(null);
    setLiveChecked(false);
    loadLiveArrivals();
    intervalId = setInterval(loadLiveArrivals, 30000);

    return () => {
      isCancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [nearestStop?.stop.id]);

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
      <ScreenHeader title="Tramvay" subtitle="Yaz tarifesine göre yaklaşan seferler" onBack={onBack} />

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
        <View style={styles.statusRow}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: hasLiveArrivals ? theme.colors.success : liveChecked ? theme.colors.warning : theme.colors.textTertiary },
            ]}
          />
          <Text style={[styles.statusText, { color: theme.colors.textSecondary }]}>
            {hasLiveArrivals ? 'Canlı Nimbus' : liveChecked ? 'Tarifeli tahmin' : 'Nimbus kontrol ediliyor'}
          </Text>
        </View>

        <View style={[styles.stopCard, { backgroundColor: theme.colors.surface }]}>
          {locationLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <Text style={[styles.cardText, { color: theme.colors.textSecondary }]}>Konum alınıyor...</Text>
            </View>
          ) : locationError ? (
            <Text style={[styles.cardText, { color: theme.colors.error }]}>{locationError}</Text>
          ) : nearestStop ? (
            <>
              <View style={styles.stopCardLeft}>
                <View style={[styles.stopIconCircle, { backgroundColor: theme.colors.surfaceSecondary }]}>
                  <MaterialIcons name="tram" size={22} color={theme.colors.primaryLight} />
                </View>
                <View style={styles.stopTextCol}>
                  <Text style={[styles.stopName, { color: theme.colors.textPrimary }]} numberOfLines={2}>
                    {nearestStop.stop.name}
                  </Text>
                  <Text style={[styles.cardText, { color: theme.colors.textSecondary }]}>
                    {formatDistance(nearestStop.distance)} uzakta
                  </Text>
                </View>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stopChips}>
                {nearestStop.stop.lines.map((line) => (
                  <View key={line} style={[styles.stopChip, { backgroundColor: theme.colors.surfaceSecondary }]}>
                    <Text style={[styles.stopChipText, { color: theme.colors.textSecondary }]}>{line}</Text>
                  </View>
                ))}
              </ScrollView>
            </>
          ) : (
            <Text style={[styles.cardText, { color: theme.colors.textSecondary }]}>Yakın durak hesaplanamadı.</Text>
          )}
        </View>

        {nearestStop && (
          <View>
            <View
              style={[
                styles.etaCard,
                {
                  backgroundColor: theme.colors.surfaceSecondary,
                  borderLeftColor: hasLiveArrivals ? theme.colors.success : theme.colors.primary,
                },
              ]}
            >
              {primaryArrival ? (
                <>
                  <View style={styles.etaHeaderRow}>
                    <View style={styles.etaHeaderLeft}>
                      <View
                        style={[
                          styles.lineBadge,
                          { backgroundColor: hasLiveArrivals ? theme.colors.success : theme.colors.primary },
                        ]}
                      >
                        <Text style={styles.lineBadgeText}>{primaryArrival.lineRef}</Text>
                      </View>
                      <Text
                        style={[
                          styles.etaStatusText,
                          { color: hasLiveArrivals ? theme.colors.success : theme.colors.primaryLight },
                        ]}
                      >
                        {primaryArrival.metaLabel}
                      </Text>
                    </View>
                    <Text style={[styles.etaTime, { color: theme.colors.textSecondary }]}>{primaryArrival.arrivalTime}</Text>
                  </View>

                  <Text style={[styles.arrivalRoute, { color: theme.colors.textPrimary }]} numberOfLines={1}>
                    {primaryArrival.routeName}
                  </Text>

                  <View style={styles.bigEtaRow}>
                    <Text style={[styles.etaBig, { color: theme.colors.textPrimary }]}>{primaryArrival.etaMinutes}</Text>
                    <Text style={[styles.etaUnit, { color: theme.colors.textSecondary }]}>dakika</Text>
                  </View>
                </>
              ) : (
                <Text style={[styles.emptyArrivalText, { color: theme.colors.textSecondary }]}>
                  Bu durak için yaklaşan geçiş bulunamadı.
                </Text>
              )}
            </View>

            {nextArrivals.length > 0 && (
              <View style={[styles.scheduleCard, { backgroundColor: theme.colors.surface }]}>
                <View style={[styles.scheduleHeader, { borderBottomColor: theme.colors.divider }]}>
                  <Text style={[styles.scheduleTitle, { color: theme.colors.textPrimary }]}>Sonraki Seferler</Text>
                </View>
                {nextArrivals.map((arrival, index) => (
                  <View
                    key={arrival.key}
                    style={[
                      styles.scheduleRow,
                      index < nextArrivals.length - 1 && {
                        borderBottomColor: theme.colors.divider,
                        borderBottomWidth: StyleSheet.hairlineWidth,
                      },
                    ]}
                  >
                    <View style={styles.scheduleLeft}>
                      <View style={[styles.schedBadge, { backgroundColor: theme.colors.surfaceSecondary }]}>
                        <Text style={[styles.schedBadgeText, { color: theme.colors.textPrimary }]}>{arrival.lineRef}</Text>
                      </View>
                      <View style={styles.scheduleTextCol}>
                        <Text style={[styles.schedDir, { color: theme.colors.textPrimary }]} numberOfLines={1}>
                          {arrival.routeName}
                        </Text>
                        <Text style={[styles.schedMeta, { color: theme.colors.textSecondary }]}>
                          {arrival.arrivalTime} · {arrival.metaLabel}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.schedEta, { color: index === 0 ? theme.colors.primaryLight : theme.colors.textSecondary }]}>
                      {arrival.etaMinutes} dk
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        <View style={[styles.hidden, styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderLight }]}>
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

              {displayArrivals.length > 0 ? (
                <View style={styles.arrivalList}>
                  {displayArrivals.map((arrival) => (
                    <View
                      key={arrival.key}
                      style={[styles.arrivalRow, { borderColor: theme.colors.borderLight }]}
                    >
                      <View style={styles.arrivalMain}>
                        <Text style={[styles.arrivalRoute, { color: theme.colors.textPrimary }]} numberOfLines={1}>
                          {arrival.routeName}
                        </Text>
                        <Text style={[styles.arrivalMeta, { color: theme.colors.textSecondary }]}>
                          {arrival.lineRef} · {arrival.arrivalTime} · {arrival.metaLabel}
                        </Text>
                      </View>
                      <Text style={[styles.arrivalEta, { color: theme.colors.primary }]}>~{arrival.etaMinutes} dk</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={[styles.cardText, { color: theme.colors.textSecondary }]}>
                  Bu durak için yaklaşan tarifeli geçiş bulunamadı.
                </Text>
              )}
            </>
          ) : (
            <Text style={[styles.cardText, { color: theme.colors.textSecondary }]}>Yakın durak hesaplanamadı.</Text>
          )}
          <Text style={[styles.note, { color: theme.colors.textTertiary }]}>
            {hasLiveArrivals
              ? `Nimbus canlı durak verisi kullanılıyor (${liveStopArrivals?.nimbusStopName || 'tramvay durağı'}).`
              : liveChecked
                ? 'Nimbus verisi alınamazsa yaz tarifesi ve durak sırası tahmini kullanılır.'
                : 'Canlı Nimbus verisi kontrol ediliyor; bu sırada tarifeli tahmin korunur.'}
          </Text>
        </View>

        <View style={styles.lineList}>
          <Text style={[styles.listTitle, { color: theme.colors.textPrimary }]}>
            {nearestStop ? `${nearestStop.stop.name} durağından geçen hatlar` : 'Tramvay hatları'}
          </Text>
          {visibleLines.map((line) => (
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
    maxHeight: 390,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  panelContent: {
    padding: 12,
    gap: 8,
  },
  hidden: {
    display: 'none',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  stopCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  stopCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  stopIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopTextCol: {
    flexShrink: 1,
  },
  stopChips: {
    gap: 4,
    alignItems: 'center',
  },
  stopChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  stopChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  etaCard: {
    borderRadius: 12,
    borderLeftWidth: 4,
    padding: 16,
  },
  etaHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  etaHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  lineBadge: {
    minWidth: 40,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignItems: 'center',
  },
  lineBadgeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  etaStatusText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flexShrink: 1,
  },
  etaTime: {
    fontSize: 12,
    fontWeight: '600',
  },
  bigEtaRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginTop: 8,
  },
  etaBig: {
    fontSize: 48,
    lineHeight: 50,
    fontWeight: '800',
    letterSpacing: -1,
  },
  etaUnit: {
    fontSize: 20,
    fontWeight: '600',
  },
  emptyArrivalText: {
    fontSize: 16,
    fontWeight: '600',
  },
  scheduleCard: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
  },
  scheduleHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  scheduleTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  scheduleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  scheduleTextCol: {
    flex: 1,
    gap: 2,
  },
  schedBadge: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  schedBadgeText: {
    fontSize: 14,
    fontWeight: '700',
  },
  schedDir: {
    fontSize: 16,
    fontWeight: '600',
  },
  schedMeta: {
    fontSize: 12,
    fontWeight: '600',
  },
  schedEta: {
    width: 58,
    textAlign: 'right',
    fontSize: 16,
    fontWeight: '700',
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
  arrivalList: {
    gap: 6,
    marginTop: 4,
  },
  arrivalRow: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  arrivalMain: {
    flex: 1,
    gap: 2,
  },
  arrivalRoute: {
    fontSize: 13,
    fontWeight: '900',
  },
  arrivalMeta: {
    fontSize: 12,
    fontWeight: '700',
  },
  arrivalEta: {
    width: 58,
    textAlign: 'right',
    fontSize: 14,
    fontWeight: '900',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lineList: {
    gap: 8,
  },
  listTitle: {
    fontSize: 14,
    fontWeight: '900',
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
