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
import journeyPlanner, { Journey, JourneyLeg, JourneyStop } from '../services/routing/JourneyPlanner';
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

function fmtTime(d: Date): string {
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

export const RoutePlannerScreen: React.FC<RoutePlannerScreenProps> = ({ onBack }) => {
  const { colors } = useTheme();
  const webViewRef = useRef<WebView>(null);
  const [isReady, setIsReady] = useState(false);
  const [query, setQuery] = useState('');
  const [destination, setDestination] = useState<Destination | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
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
        {destination && (
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
                    fastest={index === 0}
                    selected={index === selectedIndex}
                    onPress={() => setSelectedIndex(index)}
                  />
                ))}
              </ScrollView>
            )}
          </View>
        )}
      </View>

      <AppBottomNav active="home" onHome={onBack} />
    </View>
  );
};

const JourneyCard: React.FC<{ journey: Journey; fastest: boolean; selected: boolean; onPress: () => void }> = ({ journey, fastest, selected, onPress }) => {
  const { colors } = useTheme();
  const accent = fastest ? colors.primary : colors.warning;
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
            <Text style={[styles.minBig, { color: fastest ? colors.primaryLight : colors.textPrimary }]}>{journey.totalApproxMin}</Text>
            <Text style={[styles.minUnit, { color: colors.textSecondary }]}>dk</Text>
          </View>
          <Text style={[styles.timeRange, { color: colors.textSecondary }]}>{fmtTime(now)} - {fmtTime(end)}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: accent + '29' }]}>
          <MaterialIcons name={fastest ? 'bolt' : 'accessible'} size={15} color={accent} />
          <Text style={[styles.badgeText, { color: accent }]}>{fastest ? 'En Hızlı' : 'Alternatif'}</Text>
        </View>
      </View>

      <View style={styles.timeline}>
        {journey.legs.map((leg, i) => (
          <React.Fragment key={`${leg.type}-${i}`}>
            {i > 0 && <MaterialIcons name="chevron-right" size={16} color={colors.textTertiary} />}
            <LegChip leg={leg} />
          </React.Fragment>
        ))}
      </View>
    </TouchableOpacity>
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
  timeline: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
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
