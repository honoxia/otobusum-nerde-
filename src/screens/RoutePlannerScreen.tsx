import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { config } from '../config';
import { buildOsmHtml } from '../components/Map/osmMapHtml';
import { AppTopBar } from '../components/common/AppTopBar';
import { AppBottomNav } from '../components/common/AppBottomNav';
import { useLocation } from '../hooks/useLocation';
import journeyPlanner, { Journey, JourneyLabel, JourneyLeg, JourneyStop } from '../services/routing/JourneyPlanner';
import tramService from '../services/tram/TramService';
import { Coordinates } from '../types/shared-types';

interface RoutePlannerScreenProps {
  onBack: () => void;
}

interface Destination {
  name: string;
  coordinates: Coordinates;
}

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

const MODE_ICON: Record<string, IconName> = {
  bus: 'directions-bus',
  tram: 'tram',
  dolmus: 'airport-shuttle',
};

const JOURNEY_LABEL: Record<JourneyLabel, { text: string; icon: IconName }> = {
  fastest: { text: 'En Hızlı', icon: 'bolt' },
  leastWalking: { text: 'Az Yürüyüş', icon: 'directions-walk' },
  tram: { text: 'Tramvaylı', icon: 'tram' },
  dolmus: { text: 'Dolmuş', icon: 'airport-shuttle' },
  balanced: { text: 'Dengeli', icon: 'alt-route' },
};

function fmtTime(d: Date): string {
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function formatMeters(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}

function journeyWaitMinutes(journey: Journey): number {
  return journey.legs.reduce((sum, leg) => (leg.type === 'transit' ? sum + leg.waitMin : sum), 0);
}

export const RoutePlannerScreen: React.FC<RoutePlannerScreenProps> = ({ onBack }) => {
  const { colors } = useTheme();
  const webViewRef = useRef<WebView>(null);
  const [isReady, setIsReady] = useState(false);
  const [query, setQuery] = useState('');
  const [destination, setDestination] = useState<Destination | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [panelMode, setPanelMode] = useState<'list' | 'compact' | 'directions'>('list');
  const { location, error: locationError, isLoading: locationLoading } = useLocation();

  const html = useMemo(() => buildOsmHtml({ tileUrl: config.map.tileUrl }), []);
  const suggestions = useMemo(() => journeyPlanner.searchStops(query, 6), [query]);
  const journeys = useMemo(() => {
    if (!location || !destination) return [];
    return journeyPlanner.plan(location, destination.coordinates, 1, 5);
  }, [location, destination]);
  const selectedJourney = journeys[selectedIndex] ?? journeys[0] ?? null;

  const pushMapData = useCallback(() => {
    const payload = JSON.stringify({
      trams: tramService.getNetwork(),
      userLocation: location,
      stops: [],
      buses: [],
    });
    webViewRef.current?.injectJavaScript(`window.updateMapData(${JSON.stringify(payload)}); true;`);
  }, [location]);

  const pushJourney = useCallback(() => {
    const payload = JSON.stringify(selectedJourney);
    webViewRef.current?.injectJavaScript(`window.updateJourneyData(${JSON.stringify(payload)}); true;`);
  }, [selectedJourney]);

  useEffect(() => { if (selectedIndex >= journeys.length) setSelectedIndex(0); }, [journeys.length, selectedIndex]);
  useEffect(() => { if (isReady) pushMapData(); }, [isReady, pushMapData]);
  useEffect(() => { if (isReady) pushJourney(); }, [isReady, pushJourney]);

  const handleDestinationSelect = (stop: JourneyStop) => {
    setDestination({ name: stop.name, coordinates: stop.coordinates });
    setQuery(stop.name);
    setSelectedIndex(0);
    setPanelMode('list');
  };

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'ready') {
        setIsReady(true);
      } else if (msg.type === 'mapTap' && msg.coordinates) {
        setDestination({ name: 'Haritadan seçilen nokta', coordinates: msg.coordinates });
        setQuery('Haritadan seçilen nokta');
        setSelectedIndex(0);
        setPanelMode('list');
      }
    } catch {}
  }, []);

  const originText = locationLoading ? 'Konum alınıyor...' : locationError ? 'Konum yok' : 'Mevcut Konumum';
  const showSuggestions = !!query.trim() && !destination && suggestions.length > 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style="light" />
      <AppTopBar onBack={onBack} />

      {/* Nereden / Nereye + çipler (sabit) */}
      <View style={styles.top}>
        <View style={[styles.planCard, { backgroundColor: colors.surface }]}>
          <View style={[styles.inputRow, { borderBottomColor: colors.divider }]}>
            <MaterialIcons name="my-location" size={20} color={colors.textTertiary} />
            <Text style={[styles.inputText, { color: colors.textPrimary }]} numberOfLines={1}>{originText}</Text>
          </View>
          <View style={styles.inputRow}>
            <MaterialIcons name="location-on" size={20} color={colors.error} />
            <TextInput
              style={[styles.inputText, { color: colors.textPrimary, paddingVertical: 0 }]}
              placeholder="Nereye"
              placeholderTextColor={colors.textTertiary}
              value={query}
              onChangeText={(t) => { setQuery(t); setDestination(null); }}
            />
          </View>
          <View style={[styles.swapBtn, { backgroundColor: '#3131C0' }]}>
            <MaterialIcons name="swap-vert" size={20} color="#B0B2FF" />
          </View>
        </View>

        <View style={styles.chipRow}>
          <View style={[styles.chip, { backgroundColor: colors.primary }]}>
            <MaterialIcons name="schedule" size={16} color="#FFFFFF" />
            <Text style={[styles.chipText, { color: '#FFFFFF' }]}>Şimdi Çık</Text>
          </View>
          <View style={[styles.chip, { borderWidth: 1, borderColor: colors.border }]}>
            <Text style={[styles.chipText, { color: colors.textSecondary }]}>Seçenekler</Text>
          </View>
        </View>
      </View>

      {/* Harita + üstünde öneri/sonuç katmanları */}
      <View style={styles.mapArea}>
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

        {!destination && (
          <View style={styles.mapHint} pointerEvents="none">
            <Text style={styles.mapHintText}>Hedefi ara ya da haritaya dokun</Text>
          </View>
        )}

        {/* Arama önerileri (harita üstünde) */}
        {showSuggestions && (
          <View style={[styles.suggestOverlay, { backgroundColor: colors.surface }]}>
            <ScrollView keyboardShouldPersistTaps="handled">
              {suggestions.map((stop) => (
                <TouchableOpacity
                  key={stop.id}
                  style={[styles.suggestionRow, { borderBottomColor: colors.divider }]}
                  onPress={() => handleDestinationSelect(stop)}
                >
                  <MaterialIcons name={MODE_ICON[stop.mode] ?? 'place'} size={20} color={colors.primaryLight} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.suggestionName, { color: colors.textPrimary }]} numberOfLines={1}>{stop.name}</Text>
                    <Text style={[styles.suggestionMeta, { color: colors.textSecondary }]} numberOfLines={1}>{stop.lines.join(', ')}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Sonuç paneli (harita üstünde, alt) */}
        {destination && panelMode === 'list' && (
          <View style={[styles.resultPanel, { backgroundColor: colors.background, borderTopColor: colors.divider }]}>
            <Text style={[styles.h2, { color: colors.textPrimary }]}>Önerilen Güzergahlar</Text>
            {locationLoading ? (
              <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
            ) : journeys.length === 0 ? (
              <Text style={[styles.info, { color: colors.textSecondary }]}>
                Bu hedef için uygun direkt veya tek aktarmalı seçenek bulunamadı.
              </Text>
            ) : (
              <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
                {journeys.map((journey, index) => (
                  <JourneyCard
                    key={`${journey.score}-${index}`}
                    journey={journey}
                    selected={index === selectedIndex}
                    onPress={() => { setSelectedIndex(index); setPanelMode('compact'); }}
                  />
                ))}
              </ScrollView>
            )}
          </View>
        )}

        {/* Seçilen rota: kompakt özet (harita öne çıkar) */}
        {destination && panelMode === 'compact' && selectedJourney && (
          <View style={[styles.compactBar, { backgroundColor: colors.surface, borderColor: colors.divider }]}>
            <TouchableOpacity style={styles.compactSummary} onPress={() => setPanelMode('list')} activeOpacity={0.8}>
              <View style={styles.minRow}>
                <Text style={[styles.minBig, { color: colors.primaryLight }]}>{selectedJourney.totalApproxMin}</Text>
                <Text style={[styles.minUnit, { color: colors.textSecondary }]}>dk</Text>
              </View>
              <View style={styles.compactTimeline}>
                {selectedJourney.legs.map((leg, i) => (
                  <React.Fragment key={`${leg.type}-${i}`}>
                    {i > 0 && <MaterialIcons name="chevron-right" size={14} color={colors.textTertiary} />}
                    <LegChip leg={leg} />
                  </React.Fragment>
                ))}
              </View>
              <MaterialIcons name="expand-less" size={22} color={colors.textTertiary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.directionsBtn, { backgroundColor: colors.primary }]}
              onPress={() => setPanelMode('directions')}
              activeOpacity={0.85}
            >
              <MaterialIcons name="format-list-numbered" size={18} color="#FFFFFF" />
              <Text style={styles.directionsBtnText}>Yol Tarifi</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Adım adım yol tarifi */}
        {destination && panelMode === 'directions' && selectedJourney && (
          <View style={[styles.resultPanel, { backgroundColor: colors.background, borderTopColor: colors.divider }]}>
            <View style={styles.directionsHeader}>
              <TouchableOpacity onPress={() => setPanelMode('compact')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <MaterialIcons name="arrow-back" size={22} color={colors.textPrimary} />
              </TouchableOpacity>
              <Text style={[styles.h2, { color: colors.textPrimary, marginBottom: 0 }]}>Yol Tarifi</Text>
              <Text style={[styles.directionsTotal, { color: colors.textSecondary }]}>{selectedJourney.totalApproxMin} dk</Text>
            </View>
            <ScrollView contentContainerStyle={{ paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
              <DirectionSteps journey={selectedJourney} />
            </ScrollView>
          </View>
        )}
      </View>

      <AppBottomNav active="home" onHome={onBack} />
    </View>
  );
};

const JourneyCard: React.FC<{ journey: Journey; selected: boolean; onPress: () => void }> = ({ journey, selected, onPress }) => {
  const { colors } = useTheme();
  const primaryLabel = journey.labels[0] ?? 'balanced';
  const label = JOURNEY_LABEL[primaryLabel];
  const accent = primaryLabel === 'fastest' ? colors.primary : primaryLabel === 'leastWalking' ? colors.success : colors.warning;
  const secondaryLabels = journey.labels.slice(1);
  const walkSummary = formatMeters(journey.walkMeters);
  const waitSummary = journeyWaitMinutes(journey);
  const now = new Date();
  const end = new Date(now.getTime() + journey.totalApproxMin * 60000);

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[
        styles.routeCard,
        { backgroundColor: colors.surface, borderLeftColor: accent },
        selected && { borderWidth: 1, borderColor: colors.primary, borderLeftWidth: 4 },
      ]}
    >
      <View style={styles.routeHeader}>
        <View>
          <View style={styles.minRow}>
            <Text style={[styles.minBig, { color: primaryLabel === 'fastest' ? colors.primaryLight : colors.textPrimary }]}>{journey.totalApproxMin}</Text>
            <Text style={[styles.minUnit, { color: colors.textSecondary }]}>dk</Text>
          </View>
          <Text style={[styles.timeRange, { color: colors.textSecondary }]}>{fmtTime(now)} - {fmtTime(end)}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: accent + '29' }]}>
          <MaterialIcons name={label.icon} size={15} color={accent} />
          <Text style={[styles.badgeText, { color: accent }]}>{label.text}</Text>
        </View>
      </View>

      {secondaryLabels.length > 0 && (
        <View style={styles.labelRow}>
          {secondaryLabels.map((item) => {
            const secondary = JOURNEY_LABEL[item];
            return (
              <View key={item} style={[styles.subBadge, { backgroundColor: colors.surfaceSecondary }]}>
                <MaterialIcons name={secondary.icon} size={13} color={colors.textSecondary} />
                <Text style={[styles.subBadgeText, { color: colors.textSecondary }]}>{secondary.text}</Text>
              </View>
            );
          })}
        </View>
      )}

      <View style={styles.timeline}>
        {journey.legs.map((leg, i) => (
          <React.Fragment key={`${leg.type}-${i}`}>
            {i > 0 && <MaterialIcons name="chevron-right" size={16} color={colors.textTertiary} />}
            <LegChip leg={leg} />
          </React.Fragment>
        ))}
      </View>

      <View style={[styles.routeMetaRow, { borderTopColor: colors.divider }]}>
        <View style={styles.routeMetaItem}>
          <MaterialIcons name="directions-walk" size={14} color={colors.textSecondary} />
          <Text style={[styles.routeMetaText, { color: colors.textSecondary }]}>{walkSummary}</Text>
        </View>
        <View style={styles.routeMetaItem}>
          <MaterialIcons name="hourglass-empty" size={14} color={colors.textSecondary} />
          <Text style={[styles.routeMetaText, { color: colors.textSecondary }]}>{waitSummary} dk bekleme</Text>
        </View>
        <View style={styles.routeMetaItem}>
          <MaterialIcons name="sync-alt" size={14} color={colors.textSecondary} />
          <Text style={[styles.routeMetaText, { color: colors.textSecondary }]}>{journey.transfers} aktarma</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const MODE_NAME: Record<string, string> = {
  bus: 'otobüsüne',
  tram: 'tramvayına',
  dolmus: 'dolmuşuna',
};

const DirectionSteps: React.FC<{ journey: Journey }> = ({ journey }) => {
  const { colors } = useTheme();

  return (
    <View>
      {journey.legs.map((leg, index) => {
        const isLast = index === journey.legs.length - 1;
        let icon: IconName = 'directions-walk';
        let title = '';
        let detail = '';

        if (leg.type === 'walk') {
          title = leg.toName === 'Hedef' ? 'Hedefe yürü' : `${leg.toName} durağına yürü`;
          detail = `${formatMeters(leg.distanceMeters)} • ${leg.approxMin} dk`;
        } else {
          icon = MODE_ICON[leg.mode] ?? 'directions-bus';
          title = `${leg.fromStop.name} durağından ${leg.line} ${MODE_NAME[leg.mode] ?? 'aracına'} bin`;
          detail = `~${leg.waitMin} dk bekleme • ${leg.numStops} durak (${leg.approxMin} dk) • ${leg.toStop.name} durağında in`;
        }

        return (
          <View key={`step-${index}`} style={styles.stepRow}>
            <View style={styles.stepRail}>
              <View style={[styles.stepIcon, { backgroundColor: colors.surfaceSecondary }]}>
                <MaterialIcons name={icon} size={18} color={colors.primaryLight} />
              </View>
              {!isLast && <View style={[styles.stepLine, { backgroundColor: colors.divider }]} />}
            </View>
            <View style={styles.stepBody}>
              <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>{index + 1}. {title}</Text>
              <Text style={[styles.stepDetail, { color: colors.textSecondary }]}>{detail}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
};

const LegChip: React.FC<{ leg: JourneyLeg }> = ({ leg }) => {
  const { colors } = useTheme();
  if (leg.type === 'walk') {
    return (
      <View style={styles.walkChip}>
        <MaterialIcons name="directions-walk" size={16} color={colors.textSecondary} />
        <Text style={[styles.walkText, { color: colors.textSecondary }]}>{leg.approxMin} dk</Text>
      </View>
    );
  }
  return (
    <View style={[styles.transitChip, { backgroundColor: colors.surfaceSecondary }]}>
      <MaterialIcons name={MODE_ICON[leg.mode] ?? 'directions-bus'} size={16} color={colors.primaryLight} />
      <Text style={[styles.transitText, { color: colors.textPrimary }]}>{leg.line}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  top: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, gap: 16 },
  planCard: { borderRadius: 12, padding: 4, position: 'relative' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    height: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  inputText: { flex: 1, fontSize: 16 },
  swapBtn: {
    position: 'absolute',
    right: 16,
    top: '50%',
    marginTop: -20,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 999,
  },
  chipText: { fontSize: 14, fontWeight: '700' },
  mapArea: { flex: 1, position: 'relative' },
  webview: { flex: 1, backgroundColor: '#0B1326' },
  mapHint: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  mapHintText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  suggestOverlay: {
    position: 'absolute',
    top: 8,
    left: 16,
    right: 16,
    maxHeight: 260,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  suggestionName: { fontSize: 15, fontWeight: '600' },
  suggestionMeta: { fontSize: 12, marginTop: 1 },
  resultPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: 320,
    borderTopWidth: 1,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    gap: 12,
  },
  compactBar: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 10,
    gap: 10,
  },
  compactSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  compactTimeline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 2,
  },
  directionsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 10,
    paddingVertical: 10,
  },
  directionsBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  directionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  directionsTotal: { marginLeft: 'auto', fontSize: 14, fontWeight: '600' },
  stepRow: { flexDirection: 'row', gap: 12 },
  stepRail: { alignItems: 'center', width: 34 },
  stepIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLine: { width: 2, flex: 1, minHeight: 14, marginVertical: 2 },
  stepBody: { flex: 1, paddingBottom: 16 },
  stepTitle: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  stepDetail: { fontSize: 12.5, marginTop: 3, lineHeight: 18 },
  h2: { fontSize: 20, fontWeight: '600' },
  info: { fontSize: 14, lineHeight: 20 },
  center: { paddingVertical: 20, alignItems: 'center' },
  routeCard: { borderRadius: 12, borderLeftWidth: 4, padding: 16, gap: 12 },
  routeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  minRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  minBig: { fontSize: 28, fontWeight: '700' },
  minUnit: { fontSize: 16 },
  timeRange: { fontSize: 12, marginTop: 2 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: { fontSize: 12, fontWeight: '600' },
  labelRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  subBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  subBadgeText: { fontSize: 11, fontWeight: '600' },
  timeline: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  routeMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  routeMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  routeMetaText: { fontSize: 11, fontWeight: '600' },
  walkChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  walkText: { fontSize: 12 },
  transitChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
  },
  transitText: { fontSize: 14, fontWeight: '700' },
});
