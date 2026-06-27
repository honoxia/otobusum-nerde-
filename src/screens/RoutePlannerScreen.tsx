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
import { useTheme } from '../theme';
import { config } from '../config';
import { buildOsmHtml } from '../components/Map/osmMapHtml';
import { ScreenHeader } from '../components/common/ScreenHeader';
import { useLocation } from '../hooks/useLocation';
import journeyPlanner, { Journey, JourneyLeg, JourneyStop } from '../services/routing/JourneyPlanner';
import tramService from '../services/tram/TramService';
import { Coordinates } from '../types/shared-types';
import { formatDistance } from '../utils/geo.utils';

interface RoutePlannerScreenProps {
  onBack: () => void;
}

interface Destination {
  name: string;
  coordinates: Coordinates;
}

function modeLabel(mode: string): string {
  if (mode === 'bus') return 'Otobüs';
  if (mode === 'tram') return 'Tramvay';
  if (mode === 'dolmus') return 'Dolmuş';
  return 'Yürü';
}

function modeIcon(mode: string): string {
  if (mode === 'bus') return '🚌';
  if (mode === 'tram') return '🚊';
  if (mode === 'dolmus') return '🚐';
  return '🚶';
}

export const RoutePlannerScreen: React.FC<RoutePlannerScreenProps> = ({ onBack }) => {
  const theme = useTheme();
  const webViewRef = useRef<WebView>(null);
  const [isReady, setIsReady] = useState(false);
  const [query, setQuery] = useState('');
  const [destination, setDestination] = useState<Destination | null>(null);
  const [selectedJourneyIndex, setSelectedJourneyIndex] = useState(0);
  const { location, error: locationError, isLoading: locationLoading } = useLocation();

  const html = useMemo(() => buildOsmHtml({ tileUrl: config.map.tileUrl }), []);
  const suggestions = useMemo(() => journeyPlanner.searchStops(query, 8), [query]);
  const journeys = useMemo(() => {
    if (!location || !destination) return [];
    return journeyPlanner.plan(location, destination.coordinates, 1);
  }, [location, destination]);
  const selectedJourney = journeys[selectedJourneyIndex] ?? journeys[0] ?? null;

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

  useEffect(() => {
    if (selectedJourneyIndex >= journeys.length) {
      setSelectedJourneyIndex(0);
    }
  }, [journeys.length, selectedJourneyIndex]);

  useEffect(() => {
    if (isReady) pushMapData();
  }, [isReady, pushMapData]);

  useEffect(() => {
    if (isReady) pushJourney();
  }, [isReady, pushJourney]);

  const handleDestinationSelect = (stop: JourneyStop) => {
    setDestination({ name: stop.name, coordinates: stop.coordinates });
    setQuery(stop.name);
    setSelectedJourneyIndex(0);
  };

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'ready') {
        setIsReady(true);
      } else if (msg.type === 'mapTap' && msg.coordinates) {
        setDestination({ name: 'Haritadan seçilen nokta', coordinates: msg.coordinates });
        setQuery('Haritadan seçilen nokta');
        setSelectedJourneyIndex(0);
      }
    } catch {}
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />
      <ScreenHeader title="Rota" subtitle="Otobüs, tramvay ve dolmuşla planla" onBack={onBack} />

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

      <ScrollView style={styles.panel} contentContainerStyle={styles.panelContent} keyboardShouldPersistTaps="handled">
        <View style={[styles.searchCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderLight }]}>
          <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Başlangıç</Text>
          <Text style={[styles.originText, { color: theme.colors.textPrimary }]}>
            {locationLoading ? 'Konum alınıyor...' : locationError ? locationError : 'Mevcut konumun'}
          </Text>

          <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Hedef</Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.colors.background,
                borderColor: theme.colors.border,
                color: theme.colors.textPrimary,
              },
            ]}
            placeholder="Durak adı ara veya haritaya dokun"
            placeholderTextColor={theme.colors.textTertiary}
            value={query}
            onChangeText={(text) => {
              setQuery(text);
              setDestination(null);
            }}
          />

          {!!query.trim() && !destination && (
            <View style={styles.suggestions}>
              {suggestions.map((stop) => (
                <TouchableOpacity
                  key={stop.id}
                  style={[styles.suggestionRow, { borderBottomColor: theme.colors.borderLight }]}
                  onPress={() => handleDestinationSelect(stop)}
                >
                  <Text style={[styles.suggestionName, { color: theme.colors.textPrimary }]} numberOfLines={1}>
                    {modeIcon(stop.mode)} {stop.name}
                  </Text>
                  <Text style={[styles.suggestionMeta, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                    {modeLabel(stop.mode)} · {stop.lines.join(', ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {locationLoading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>Konum bekleniyor...</Text>
          </View>
        )}

        {destination && !locationLoading && !locationError && journeys.length === 0 && (
          <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
            Bu hedef için 450 m çevrede uygun direkt veya tek aktarmalı seçenek bulunamadı.
          </Text>
        )}

        {journeys.map((journey, index) => (
          <JourneyCard
            key={`${journey.score}-${index}`}
            journey={journey}
            selected={index === selectedJourneyIndex}
            onPress={() => setSelectedJourneyIndex(index)}
          />
        ))}
      </ScrollView>
    </View>
  );
};

const JourneyCard: React.FC<{
  journey: Journey;
  selected: boolean;
  onPress: () => void;
}> = ({ journey, selected, onPress }) => {
  const theme = useTheme();

  return (
    <TouchableOpacity
      style={[
        styles.journeyCard,
        {
          backgroundColor: theme.colors.surface,
          borderColor: selected ? theme.colors.primary : theme.colors.borderLight,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.78}
    >
      <View style={styles.journeyHeader}>
        <Text style={[styles.journeyTitle, { color: theme.colors.textPrimary }]}>~{journey.totalApproxMin} dk</Text>
        <Text style={[styles.transferText, { color: theme.colors.textSecondary }]}>
          {journey.transfers === 0 ? 'Direkt' : `${journey.transfers} aktarma`}
        </Text>
      </View>
      <View style={styles.legs}>
        {journey.legs.map((leg, index) => (
          <LegRow key={`${leg.type}-${index}`} leg={leg} />
        ))}
      </View>
    </TouchableOpacity>
  );
};

const LegRow: React.FC<{ leg: JourneyLeg }> = ({ leg }) => {
  const theme = useTheme();

  if (leg.type === 'walk') {
    return (
      <Text style={[styles.legText, { color: theme.colors.textSecondary }]}>
        🚶 {formatDistance(leg.distanceMeters)} yürü · ~{leg.approxMin} dk
      </Text>
    );
  }

  return (
    <Text style={[styles.legText, { color: theme.colors.textPrimary }]}>
      {modeIcon(leg.mode)} {leg.line} · {leg.numStops} durak · {leg.fromStop.name} → {leg.toStop.name} · ~{leg.approxMin} dk
    </Text>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mapWrap: {
    flex: 1,
    minHeight: 230,
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
    gap: 10,
  },
  searchCard: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  originText: {
    fontSize: 15,
    fontWeight: '800',
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  suggestions: {
    gap: 0,
  },
  suggestionRow: {
    paddingVertical: 9,
    borderBottomWidth: 1,
    gap: 2,
  },
  suggestionName: {
    fontSize: 14,
    fontWeight: '800',
  },
  suggestionMeta: {
    fontSize: 12,
    fontWeight: '600',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  journeyCard: {
    borderWidth: 2,
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  journeyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  journeyTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  transferText: {
    fontSize: 13,
    fontWeight: '800',
  },
  legs: {
    gap: 5,
  },
  legText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
});
