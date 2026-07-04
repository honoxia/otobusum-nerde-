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
  lines: DolmusLine[] | null;
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

function directionLabel(line: DolmusLine): string {
  const [, to] = line.line.split(' - ');
  if (to) return `${to.trim()} yönü`;
  return line.firstStop;
}

function lineGroupName(line: DolmusLine): string {
  const match = line.line.match(/^(\S+\s+\d+)/);
  return match?.[1] ?? line.line;
}

export const DolmusMapScreen: React.FC<DolmusMapScreenProps> = ({ lines, onBack }) => {
  const { colors } = useTheme();
  const webViewRef = useRef<WebView>(null);
  const [day, setDay] = useState<DayKey>(todayKey());
  const [selectedLineIndex, setSelectedLineIndex] = useState(0);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleNow, setScheduleNow] = useState(() => new Date());
  const { location, isLoading: locationLoading } = useLocation();

  const line = lines?.[selectedLineIndex] ?? lines?.[0] ?? null;
  const title = line ? lineGroupName(line) : 'Dolmuş';
  const html = useMemo(() => buildOsmHtml({ tileUrl: config.map.tileUrl }), []);
  const [selectedLegIndex, setSelectedLegIndex] = useState<number | null>(null);
  const legInfos = useMemo(() => {
    if (!line || !location) return [];
    return dolmusService.getLegInfos(location, line);
  }, [line, location]);
  // Default to the leg whose road is physically closest to the user
  const autoLegIndex = useMemo(() => {
    let best = 0;
    legInfos.forEach((leg, index) => {
      if (leg.nearest.distanceMeters < legInfos[best].nearest.distanceMeters) best = index;
    });
    return best;
  }, [legInfos]);
  const activeLegIndex = selectedLegIndex ?? autoLegIndex;
  const activeLeg = legInfos[activeLegIndex] ?? legInfos[0] ?? null;
  const nextPassings = useMemo(() => {
    if (!line || !activeLeg) return [];
    return dolmusService.getNextPassings(line, activeLeg.minutesList, scheduleNow, 3);
  }, [line, activeLeg, scheduleNow]);

  const pushDolmus = useCallback(() => {
    if (!line) return;
    const payload = JSON.stringify({ ...line, nearestPoint: activeLeg?.nearest.point ?? null });
    webViewRef.current?.injectJavaScript(`window.updateDolmusData(${JSON.stringify(payload)}); true;`);
  }, [line, activeLeg]);

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'ready') pushDolmus();
    } catch {}
  }, [pushDolmus]);

  const rows = useMemo(() => scheduleRows(line?.schedule?.[day]), [line, day]);

  useEffect(() => {
    setSelectedLineIndex(0);
    setScheduleOpen(false);
  }, [lines]);

  // Hat değişince yön seçimini otomatiğe (en yakın bacak) döndür
  useEffect(() => {
    setSelectedLegIndex(null);
  }, [selectedLineIndex, lines]);

  useEffect(() => {
    const intervalId = setInterval(() => setScheduleNow(new Date()), 30000);
    return () => clearInterval(intervalId);
  }, []);

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

  const nextPassing = nextPassings[0] ?? null;
  const lineColor = line.color || colors.primary;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style="light" />
      <AppTopBar onBack={onBack} />

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

      <View style={[styles.panel, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <ScrollView style={styles.panelScroll} contentContainerStyle={styles.panelContent} showsVerticalScrollIndicator={false}>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: colors.success }]} />
            <Text style={[styles.statusText, { color: colors.textSecondary }]}>Tarifeli dolmuş hattı</Text>
          </View>

          {lines && lines.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.directionRow}>
              {lines.map((option, index) => {
                const active = index === selectedLineIndex;

                return (
                  <TouchableOpacity
                    key={option.line}
                    style={[
                      styles.directionChip,
                      {
                        backgroundColor: active ? colors.primary : 'transparent',
                        borderColor: active ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => setSelectedLineIndex(index)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.directionChipText, { color: active ? '#FFFFFF' : colors.textSecondary }]}>
                      {directionLabel(option)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {legInfos.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.directionRow}>
              {legInfos.map((leg, index) => {
                const active = index === activeLegIndex;

                return (
                  <TouchableOpacity
                    key={leg.label ?? String(index)}
                    style={[
                      styles.directionChip,
                      {
                        backgroundColor: active ? colors.primary : 'transparent',
                        borderColor: active ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => setSelectedLegIndex(index)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.directionChipText, { color: active ? '#FFFFFF' : colors.textSecondary }]}>
                      {leg.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          <View style={[styles.routeCard, { backgroundColor: colors.surfaceSecondary }]}>
            <View style={[styles.pinWrap, { backgroundColor: 'rgba(79, 70, 229, 0.16)' }]}>
              <MaterialIcons name="place" size={24} color={colors.primaryLight} />
            </View>
            <View style={styles.routeText}>
              <Text style={[styles.routeTitle, { color: colors.textPrimary }]} numberOfLines={2}>
                {title}
              </Text>
              <Text style={[styles.routeMeta, { color: colors.textSecondary }]} numberOfLines={1}>
                {activeLeg?.label ?? directionLabel(line)}
              </Text>
            </View>
          </View>

          <View style={[styles.etaCard, { backgroundColor: colors.surfaceSecondary, borderLeftColor: lineColor }]}>
            <View style={styles.etaTopRow}>
              <View style={[styles.lineBadge, { backgroundColor: lineColor }]}>
                <Text style={styles.lineBadgeText}>{title}</Text>
              </View>
              <Text style={[styles.nextTime, { color: colors.textSecondary }]}>
                {nextPassing ? `${nextPassing.time} geçiş` : 'Sıradaki geçiş yok'}
              </Text>
            </View>

            {locationLoading ? (
              <Text style={[styles.etaHelp, { color: colors.textSecondary }]}>Konum alınıyor...</Text>
            ) : nextPassing ? (
              <>
                <View style={styles.bigEtaRow}>
                  <Text style={[styles.bigEta, { color: colors.textPrimary }]}>{nextPassing.etaMinutes}</Text>
                  <Text style={[styles.bigEtaUnit, { color: colors.textPrimary }]}>dakika</Text>
                </View>
                <Text style={[styles.etaHelp, { color: colors.textSecondary }]}>
                  Rotaya {activeLeg ? formatDistance(activeLeg.nearest.distanceMeters) : '-'} uzaktasın
                </Text>
              </>
            ) : (
              <Text style={[styles.etaHelp, { color: colors.textSecondary }]}>
                Bugün için yaklaşan hareket saati bulunamadı.
              </Text>
            )}
          </View>

          <TouchableOpacity
            style={[styles.scheduleCard, { backgroundColor: colors.surfaceSecondary }]}
            onPress={() => setScheduleOpen((open) => !open)}
            activeOpacity={0.85}
          >
            <View style={styles.scheduleHeader}>
              <Text style={[styles.scheduleTitle, { color: colors.textPrimary }]}>Hareket Saatleri</Text>
              <MaterialIcons
                name={scheduleOpen ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                size={26}
                color={colors.textSecondary}
              />
            </View>
            <Text style={[styles.scheduleSubtitle, { color: colors.textSecondary }]}>
              İlk durak: {line.firstStop}
            </Text>
          </TouchableOpacity>

          {scheduleOpen && (
            <View style={[styles.scheduleList, { backgroundColor: colors.surfaceSecondary }]}>
              <View style={styles.dayRow}>
                {DAY_TABS.map((tab) => {
                  const active = tab.key === day;
                  return (
                    <TouchableOpacity
                      key={tab.key}
                      style={[
                        styles.dayChip,
                        active
                          ? { backgroundColor: colors.primary }
                          : { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
                      ]}
                      onPress={() => setDay(tab.key)}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.dayChipText, { color: active ? '#FFFFFF' : colors.textSecondary }]}>
                        {tab.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {rows.length === 0 ? (
                <Text style={[styles.empty, { color: colors.textTertiary }]}>Bu gün için saat bilgisi yok.</Text>
              ) : (
                rows.map(([hour, mins]) => (
                  <View key={hour} style={[styles.scheduleRow, { borderBottomColor: colors.divider }]}>
                    <Text style={[styles.hour, { color: colors.primaryLight }]}>{hour}</Text>
                    <Text style={[styles.mins, { color: colors.textPrimary }]}>
                      {mins.map((m) => String(m).padStart(2, '0')).join('  ')}
                    </Text>
                  </View>
                ))
              )}
            </View>
          )}
        </ScrollView>
      </View>

      <AppBottomNav active="home" onHome={onBack} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  mapWrap: { flex: 3, minHeight: 190 },
  webview: { flex: 1, backgroundColor: '#0B1326' },
  panel: {
    flex: 5,
    borderTopWidth: 1,
  },
  panelScroll: { flex: 1 },
  panelContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 18,
    gap: 12,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: { fontSize: 12 },
  directionRow: {
    gap: 8,
    paddingVertical: 2,
  },
  directionChip: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
  },
  directionChipText: {
    fontSize: 14,
    fontWeight: '700',
  },
  routeCard: {
    minHeight: 78,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  pinWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeText: { flex: 1, minWidth: 0 },
  routeTitle: { fontSize: 16, lineHeight: 21, fontWeight: '800' },
  routeMeta: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  etaCard: {
    borderRadius: 12,
    borderLeftWidth: 4,
    padding: 16,
    minHeight: 126,
  },
  etaTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  lineBadge: {
    minHeight: 28,
    borderRadius: 6,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lineBadgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  nextTime: { fontSize: 12 },
  bigEtaRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginTop: 10,
  },
  bigEta: {
    fontSize: 48,
    lineHeight: 58,
    fontWeight: '800',
  },
  bigEtaUnit: {
    fontSize: 20,
    fontWeight: '700',
  },
  etaHelp: {
    marginTop: 4,
    fontSize: 15,
    lineHeight: 22,
  },
  scheduleCard: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  scheduleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scheduleTitle: { fontSize: 15, lineHeight: 20, fontWeight: '800' },
  scheduleSubtitle: { fontSize: 12, lineHeight: 18, marginTop: 2 },
  scheduleList: {
    borderRadius: 12,
    padding: 12,
  },
  dayRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  dayChip: {
    flex: 1,
    height: 38,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayChipText: { fontSize: 13, fontWeight: '700' },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  hour: { width: 42, fontSize: 15, fontWeight: '800' },
  mins: { flex: 1, fontSize: 14, letterSpacing: 1 },
  empty: { paddingVertical: 16, fontSize: 13 },
});
