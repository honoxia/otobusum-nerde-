import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { useTheme } from '../../theme';
import { config } from '../../config';
import { buildOsmHtml } from '../Map/osmMapHtml';
import { ScreenHeader } from '../common/ScreenHeader';
import { DolmusDaySchedule, DolmusLine } from '../../types/shared-types';
import { useLocation } from '../../hooks/useLocation';
import dolmusService from '../../services/dolmus/DolmusService';
import { formatDistance } from '../../utils/geo.utils';

interface DolmusMapScreenProps {
  line: DolmusLine | null;
  onBack: () => void;
}

type DayKey = 'weekday' | 'saturday' | 'sunday';

const DAY_TABS: { key: DayKey; label: string }[] = [
  { key: 'weekday', label: 'Hafta İçi' },
  { key: 'saturday', label: 'Cumartesi' },
  { key: 'sunday', label: 'Pazar' },
];

function todayKey(): DayKey {
  const d = new Date().getDay();
  if (d === 0) return 'sunday';
  if (d === 6) return 'saturday';
  return 'weekday';
}

function scheduleRows(day: DolmusDaySchedule | undefined): [string, number[]][] {
  if (!day) return [];
  return Object.entries(day).sort(([a], [b]) => Number(a) - Number(b));
}

export const DolmusMapScreen: React.FC<DolmusMapScreenProps> = ({ line, onBack }) => {
  const theme = useTheme();
  const webViewRef = useRef<WebView>(null);
  const [day, setDay] = useState<DayKey>(todayKey());
  const { location, error: locationError, isLoading: locationLoading } = useLocation();

  const html = useMemo(() => buildOsmHtml({ tileUrl: config.map.tileUrl }), []);
  const nearestInfo = useMemo(() => {
    if (!line || !location) return null;
    return dolmusService.getNearestInfo(location, line);
  }, [line, location]);
  const nextPassings = useMemo(() => {
    if (!line || !nearestInfo) return [];
    return dolmusService.getNextPassings(line, nearestInfo.minutesAtPoint, new Date(), 3);
  }, [line, nearestInfo]);

  const pushDolmus = useCallback(() => {
    if (!line) return;
    const payload = JSON.stringify({
      ...line,
      nearestPoint: nearestInfo?.nearest.point ?? null,
    });
    webViewRef.current?.injectJavaScript(
      `window.updateDolmusData(${JSON.stringify(payload)}); true;`
    );
  }, [line, nearestInfo]);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const msg = JSON.parse(event.nativeEvent.data);
        if (msg.type === 'ready') pushDolmus();
      } catch {}
    },
    [pushDolmus]
  );

  const rows = useMemo(() => scheduleRows(line?.schedule?.[day]), [line, day]);

  useEffect(() => {
    pushDolmus();
  }, [pushDolmus]);

  if (!line) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <StatusBar style={theme.isDark ? 'light' : 'dark'} />
        <ScreenHeader title="Dolmuş" subtitle="Tanımlı dolmuş hattı bulunamadı" onBack={onBack} />
        <View style={styles.emptyState}>
          <Text style={[styles.empty, { color: theme.colors.textTertiary }]}>Dolmuş verisi henüz yok.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />
      <ScreenHeader
        title={line.line}
        subtitle={`${line.operator || 'Dolmuş'} · ${line.waypoints.length} durak${line.loop ? ' · halka' : ''}`}
        onBack={onBack}
      />

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

      <View style={[styles.infoCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderLight }]}>
        <Text style={[styles.infoTitle, { color: theme.colors.textPrimary }]}>Sana en yakın nokta</Text>
        {locationLoading ? (
          <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>Konum alınıyor...</Text>
        ) : locationError ? (
          <Text style={[styles.infoText, { color: theme.colors.error }]}>{locationError}</Text>
        ) : nearestInfo ? (
          <>
            <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
              Yaklaşık {formatDistance(nearestInfo.nearest.distanceMeters)} yürüme mesafesinde.
            </Text>
            <Text style={[styles.passingText, { color: theme.colors.textPrimary }]}>
              Tahmini geçiş: {nextPassings.length > 0 ? nextPassings.map((passing) => passing.time).join(', ') : 'Bugün kalan sefer yok'}
            </Text>
          </>
        ) : (
          <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
            Bu hat için en yakın nokta hesaplanamadı.
          </Text>
        )}
      </View>

      <View style={[styles.tabs, { borderTopColor: theme.colors.border }]}>
        {DAY_TABS.map((tab) => {
          const active = tab.key === day;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.tab,
                { backgroundColor: active ? line.color || '#E11D2A' : theme.colors.surface },
              ]}
              onPress={() => setDay(tab.key)}
            >
              <Text style={[styles.tabText, { color: active ? '#fff' : theme.colors.textSecondary }]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView style={styles.schedule} contentContainerStyle={styles.scheduleContent}>
        <Text style={[styles.scheduleTitle, { color: theme.colors.textSecondary }]}>
          İlk duraktan ({line.firstStop}) hareket saatleri
        </Text>
        {rows.length === 0 ? (
          <Text style={[styles.empty, { color: theme.colors.textTertiary }]}>
            Bu gün için saat bilgisi yok.
          </Text>
        ) : (
          rows.map(([hour, mins]) => (
            <View key={hour} style={[styles.row, { borderBottomColor: theme.colors.borderLight }]}>
              <Text style={[styles.hour, { color: line.color || '#E11D2A' }]}>{hour}</Text>
              <Text style={[styles.mins, { color: theme.colors.textPrimary }]}>
                {mins.map((m) => String(m).padStart(2, '0')).join('  ')}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  mapWrap: { flex: 1, minHeight: 220 },
  webview: { flex: 1, backgroundColor: '#e5e7eb' },
  infoCard: {
    marginHorizontal: 10,
    marginTop: 10,
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
    gap: 5,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  infoText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  passingText: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '800',
  },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    padding: 10,
    borderTopWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabText: { fontSize: 13, fontWeight: '700' },
  schedule: { maxHeight: 260 },
  scheduleContent: { paddingHorizontal: 14, paddingBottom: 24 },
  scheduleTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    paddingVertical: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  hour: { width: 40, fontSize: 15, fontWeight: '800' },
  mins: { flex: 1, fontSize: 14, letterSpacing: 1 },
  empty: { paddingVertical: 16, fontSize: 13 },
});
