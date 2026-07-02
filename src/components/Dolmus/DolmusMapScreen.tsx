import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { useTheme } from '../../theme';
import { config } from '../../config';
import { buildOsmHtml } from '../Map/osmMapHtml';
import { AppTopBar } from '../common/AppTopBar';
import { AppBottomNav } from '../common/AppBottomNav';
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
  const { colors } = useTheme();
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
    const payload = JSON.stringify({ ...line, nearestPoint: nearestInfo?.nearest.point ?? null });
    webViewRef.current?.injectJavaScript(`window.updateDolmusData(${JSON.stringify(payload)}); true;`);
  }, [line, nearestInfo]);

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'ready') pushDolmus();
    } catch {}
  }, [pushDolmus]);

  const rows = useMemo(() => scheduleRows(line?.schedule?.[day]), [line, day]);

  useEffect(() => { pushDolmus(); }, [pushDolmus]);

  if (!line) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar style="light" />
        <AppTopBar onBack={onBack} />
        <View style={styles.emptyState}>
          <Text style={[styles.empty, { color: colors.textTertiary }]}>Dolmuş verisi henüz yok.</Text>
        </View>
        <AppBottomNav active="home" onHome={onBack} />
      </View>
    );
  }

  const nextTime = nextPassings[0]?.time ?? null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style="light" />
      <AppTopBar onBack={onBack} />

      {/* Harita + üstünde canlı geçiş kartı */}
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

        <View style={[styles.liveCard, { backgroundColor: colors.surface }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.liveKicker, { color: colors.primaryLight }]}>
              MİNİBÜS · {line.line}
            </Text>
            <Text style={[styles.liveRoute, { color: colors.textPrimary }]} numberOfLines={1}>
              {line.firstStop} - {line.lastStop}
            </Text>
            <Text style={[styles.liveStatus, { color: colors.textSecondary }]}>
              {locationLoading
                ? 'Konum alınıyor...'
                : nearestInfo
                  ? `${formatDistance(nearestInfo.nearest.distanceMeters)} uzakta`
                  : 'En yakın nokta yok'}
            </Text>
            {nextTime && (
              <View style={styles.etaRow}>
                <Text style={[styles.etaBig, { color: colors.textPrimary }]}>{nextTime}</Text>
                <Text style={[styles.etaUnit, { color: colors.textSecondary }]}>sıradaki</Text>
              </View>
            )}
          </View>
          <View style={styles.liveBadge}>
            <MaterialIcons name="airport-shuttle" size={26} color={colors.primaryLight} />
          </View>
        </View>
      </View>

      {/* Gün çipleri */}
      <View style={styles.chipRow}>
        {DAY_TABS.map((tab) => {
          const active = tab.key === day;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.chip,
                active
                  ? { backgroundColor: colors.primary }
                  : { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
              ]}
              onPress={() => setDay(tab.key)}
              activeOpacity={0.85}
            >
              <Text style={[styles.chipText, { color: active ? '#FFFFFF' : colors.textSecondary }]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Tarife */}
      <ScrollView style={styles.schedule} contentContainerStyle={styles.scheduleContent}>
        <Text style={[styles.scheduleTitle, { color: colors.textTertiary }]}>
          İlk duraktan ({line.firstStop}) hareket saatleri
        </Text>
        {rows.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textTertiary }]}>Bu gün için saat bilgisi yok.</Text>
        ) : (
          rows.map(([hour, mins]) => (
            <View key={hour} style={[styles.row, { borderBottomColor: colors.divider }]}>
              <Text style={[styles.hour, { color: colors.primaryLight }]}>{hour}</Text>
              <Text style={[styles.mins, { color: colors.textPrimary }]}>
                {mins.map((m) => String(m).padStart(2, '0')).join('  ')}
              </Text>
            </View>
          ))
        )}
      </ScrollView>

      <AppBottomNav active="home" onHome={onBack} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  mapWrap: { flex: 1, minHeight: 220 },
  webview: { flex: 1, backgroundColor: '#0B1326' },
  liveCard: {
    position: 'absolute',
    top: 14,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  liveKicker: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  liveRoute: { fontSize: 16, fontWeight: '700', marginTop: 2 },
  liveStatus: { fontSize: 13, marginTop: 2 },
  etaRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 4 },
  etaBig: { fontSize: 26, fontWeight: '800' },
  etaUnit: { fontSize: 13 },
  liveBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(79, 70, 229, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  chip: {
    flex: 1,
    height: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { fontSize: 14, fontWeight: '700' },
  schedule: { maxHeight: 240 },
  scheduleContent: { paddingHorizontal: 16, paddingBottom: 16 },
  scheduleTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', paddingVertical: 8 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  hour: { width: 42, fontSize: 15, fontWeight: '800' },
  mins: { flex: 1, fontSize: 14, letterSpacing: 1 },
  empty: { paddingVertical: 16, fontSize: 13 },
});
