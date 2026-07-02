import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Speech from 'expo-speech';
import Toast from 'react-native-toast-message';

import { useTheme } from '../theme';
import { MapContainer } from '../components/Map/MapContainer';
import { StopCard } from '../components/StopCard/StopCard';
import { ETACard } from '../components/ETACard/ETACard';
import { StopDetailSheet, StopDetailSheetRef } from '../components/BottomSheet/StopDetailSheet';
import { SkeletonCard } from '../components/common/Skeleton';
import { AppTopBar } from '../components/common/AppTopBar';
import { AppBottomNav } from '../components/common/AppBottomNav';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocation } from '../hooks/useLocation';
import { useStops } from '../hooks/useStops';
import { useNearestStop } from '../hooks/useNearestStop';
import { useLiveVehicles } from '../hooks/useLiveVehicles';
import etaService from '../services/ETAService';
import routeService, { RouteDirectionOption } from '../services/routes/RouteService';
import { extractLineNumber } from '../utils/queryParser';
import { BusStop, ETAResult } from '../types/shared-types';
import { calculateHaversineDistance } from '../utils/geo.utils';
import { devLog } from '../utils/devLog';

let sttAvailable = false;
let Voice: any = null;

try {
  Voice = require('@react-native-voice/voice').default;
  sttAvailable = true;
} catch {
  sttAvailable = false;
}

interface BusScreenProps {
  onBack: () => void;
}

export const BusScreen: React.FC<BusScreenProps> = ({ onBack }) => {
  const theme = useTheme();
  const bottomSheetRef = useRef<StopDetailSheetRef>(null);

  const [query, setQuery] = useState('');
  const [etaResult, setEtaResult] = useState<ETAResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [sttEnabled] = useState(sttAvailable);
  const [selectedStop, setSelectedStop] = useState<BusStop | null>(null);
  const [selectedStopDistance, setSelectedStopDistance] = useState(0);
  const [selectedLine, setSelectedLine] = useState<string | null>(null);
  const [directionOptions, setDirectionOptions] = useState<RouteDirectionOption[]>([]);
  const [selectedDirectionFull, setSelectedDirectionFull] = useState<string | null>(null);
  const [mapExpanded, setMapExpanded] = useState(false);

  const { location, error: locationError, isLoading: locationLoading } = useLocation();
  const { stops: allStops, isLoading: stopsLoading } = useStops();
  const { nearestStop } = useNearestStop(location);
  const { vehicles: buses, isConnected, connectionStatus } = useLiveVehicles();

  const nearbyStops = useMemo(() => {
    if (!location || !allStops.length) {
      devLog('[APP] nearbyStops: No location or stops', { location: !!location, stopsCount: allStops.length });
      return [];
    }

    const nearby = allStops.filter((stop) => {
      const dist = calculateHaversineDistance(location, stop.coordinates);
      return dist <= 1000;
    });

    devLog(`[APP] nearbyStops: ${nearby.length} durak (1000m içinde), toplam: ${allStops.length}`);
    nearby.slice(0, 3).forEach((stop) => {
      devLog(`[APP]    - ${stop.name} (${stop.lines.join(', ')})`);
    });

    return nearby;
  }, [location, allStops]);

  const speakText = (text: string) => {
    Speech.speak(text, {
      language: 'tr-TR',
    });
  };

  const showToast = (type: 'success' | 'error' | 'info', title: string, message?: string) => {
    Toast.show({
      type,
      text1: title,
      text2: message,
      position: 'top',
      visibilityTime: 3000,
    });
  };

  const handleQuery = useCallback(
    async (text: string, directionOverride?: string | null) => {
      if (!location) {
        const msg = 'Konum bilgisi alınamadı.';
        setEtaResult({ status: 'error', errorMessage: msg });
        showToast('error', 'Hata', msg);
        speakText(msg);
        return;
      }

      const line = extractLineNumber(text);
      if (!line) {
        setDirectionOptions([]);
        setSelectedDirectionFull(null);
        const msg = 'Hat numarası anlaşılamadı.';
        setEtaResult({ status: 'error', errorMessage: msg });
        showToast('error', 'Hata', msg);
        speakText(msg);
        return;
      }

      setLoading(true);
      setEtaResult(null);
      setSelectedLine(line);

      const routeOptions = routeService.getRouteOptionsForLine(line);
      const requestedDirection = directionOverride === undefined ? selectedDirectionFull : directionOverride;
      const activeDirection = requestedDirection && routeOptions.some(option => option.direction === requestedDirection)
        ? requestedDirection
        : null;
      setDirectionOptions(routeOptions);
      setSelectedDirectionFull(activeDirection);

      try {
        const result = await etaService.calculateETAWithSchedule(location, line, buses, activeDirection);
        setEtaResult(result);

        let speechText = '';
        if (result.status === 'ok' && result.etaMinutes !== null && result.etaMinutes !== undefined) {
          speechText = `${result.line} hattı, ${result.stopName} durağına yaklaşık ${result.etaMinutes} dakika.`;
          showToast('success', `${result.line} hattı`, `${result.etaMinutes} dakika`);
        } else if (result.status === 'no_vehicle_approaching') {
          speechText = `${line} hattında şu anda yaklaşan araç görünmüyor.`;
          showToast('info', `${line} hattı`, 'Yaklaşan araç yok');
        } else if (result.status === 'no_nearby_stop') {
          speechText = `${line} hattı bu konuma yakın duraklardan geçmiyor.`;
          showToast('info', `${line} hattı`, 'Yakın durak yok');
        } else {
          speechText = 'ETA bilgisi alınamadı.';
          showToast('error', 'Hata', speechText);
        }
        speakText(speechText);
      } catch (error: any) {
        const msg = error.message || 'Hesaplama hatası.';
        setEtaResult({ status: 'error', errorMessage: msg });
        showToast('error', 'Hata', msg);
        speakText(msg);
      } finally {
        setLoading(false);
      }
    },
    [location, buses, selectedDirectionFull]
  );

  useEffect(() => {
    if (!sttAvailable || !Voice) return;

    try {
      Voice.onSpeechResults = (e: any) => {
        if (e.value && e.value.length > 0) {
          const text = e.value[0];
          setQuery(text);
          handleQuery(text);
        }
        setIsListening(false);
      };
      Voice.onSpeechError = () => setIsListening(false);
      Voice.onSpeechEnd = () => setIsListening(false);
    } catch {
      if (__DEV__) console.log('Voice setup failed');
    }

    return () => {
      try {
        Voice.destroy().then(() => Voice.removeAllListeners());
      } catch {}
    };
  }, [handleQuery]);

  const startListening = async () => {
    if (!sttEnabled || !Voice) return;
    try {
      setIsListening(true);
      await Voice.start('tr-TR');
    } catch {
      setIsListening(false);
    }
  };

  const stopListening = async () => {
    if (!sttEnabled || !Voice) return;
    try {
      await Voice.stop();
      setIsListening(false);
    } catch {
      setIsListening(false);
    }
  };

  const handleSubmit = () => {
    if (query.trim()) {
      handleQuery(query.trim());
    }
  };

  const handleLinePress = (line: string) => {
    setQuery(line);
    setSelectedLine(line);
    setSelectedDirectionFull(null);
    handleQuery(line, null);
  };

  const handleDirectionPress = (direction: string | null) => {
    setSelectedDirectionFull(direction);
    const text = query.trim() || selectedLine || '';
    if (text) {
      handleQuery(text, direction);
    }
  };

  const handleStopPress = (stop: BusStop) => {
    setSelectedStop(stop);
    if (location) {
      const dist = calculateHaversineDistance(location, stop.coordinates);
      setSelectedStopDistance(dist);
    }
    bottomSheetRef.current?.snapToIndex(0);
  };

  const isLoading = locationLoading || stopsLoading;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar style="light" />
      <AppTopBar onBack={onBack} />

      <View style={mapExpanded ? styles.mapExpanded : styles.mapCollapsed}>
        {isLoading ? (
          <View style={[styles.mapPlaceholder, { backgroundColor: theme.colors.surface }]}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>Yükleniyor...</Text>
          </View>
        ) : locationError ? (
          <View style={[styles.mapPlaceholder, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.errorText, { color: theme.colors.error }]}>{locationError}</Text>
          </View>
        ) : (
          <MapContainer
            userLocation={location}
            stops={nearbyStops}
            nearestStopId={nearestStop?.stop?.id}
            buses={buses}
            onStopPress={handleStopPress}
          />
        )}

        {!mapExpanded && !isLoading && !locationError && (
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setMapExpanded(true)}>
            <View style={styles.expandHint}>
              <Text style={styles.expandHintText}>Haritaya dokun → büyüt ⤢</Text>
            </View>
          </Pressable>
        )}

        {mapExpanded && (
          <TouchableOpacity style={styles.collapseBtn} onPress={() => setMapExpanded(false)}>
            <Text style={styles.collapseBtnText}>Küçült ×</Text>
          </TouchableOpacity>
        )}
      </View>

      <View
        style={[
          styles.bottomContainer,
          mapExpanded ? styles.bottomExpanded : styles.bottomCollapsed,
          { backgroundColor: theme.colors.background, borderTopColor: theme.colors.border },
        ]}
      >
        <ScrollView
          style={styles.bottomScroll}
          contentContainerStyle={styles.bottomScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: isConnected ? theme.colors.success : theme.colors.error }]} />
            <Text style={[styles.statusText, { color: theme.colors.textSecondary }]}>
              {isConnected
                ? `Canlı: ${buses.length} otobüs`
                : connectionStatus === 'connecting'
                  ? 'Bağlanıyor...'
                  : 'Bağlantı yok'}
            </Text>
          </View>

          {selectedLine && directionOptions.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.directionRow}>
              {directionOptions.map(option => {
                const active = selectedDirectionFull === option.direction;

                return (
                  <TouchableOpacity
                    key={option.routeId}
                    style={[
                      styles.directionChip,
                      {
                        backgroundColor: active ? theme.colors.primary : 'transparent',
                        borderColor: active ? theme.colors.primary : theme.colors.border,
                      },
                    ]}
                    onPress={() => handleDirectionPress(option.direction)}
                    disabled={loading}
                  >
                    <Text
                      style={[
                        styles.directionChipText,
                        { color: active ? '#fff' : theme.colors.textSecondary },
                      ]}
                    >
                      {option.line !== selectedLine ? `${option.line} ${option.label}` : option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {isLoading ? (
            <SkeletonCard />
          ) : (
            nearestStop?.stop && (
              <StopCard
                stop={nearestStop.stop}
                distance={nearestStop.distance}
                onLinePress={handleLinePress}
                selectedLine={selectedLine}
              />
            )
          )}

          {etaResult && (
            <View style={styles.etaContainer}>
              <ETACard result={etaResult} />
            </View>
          )}
        </ScrollView>

        <View style={styles.searchRow}>
          <View style={[styles.searchInputWrap, { backgroundColor: theme.colors.surfaceSecondary }]}>
            <TextInput
              style={[styles.searchInput, { color: theme.colors.textPrimary }]}
              placeholder="Örn: 54 ne zaman gelecek?"
              placeholderTextColor={theme.colors.textTertiary}
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={handleSubmit}
              returnKeyType="search"
              editable={!loading}
            />
            {sttEnabled && (
              <TouchableOpacity
                style={styles.micBtn}
                onPressIn={startListening}
                onPressOut={stopListening}
                disabled={loading}
              >
                <MaterialIcons name="mic" size={22} color={isListening ? theme.colors.error : theme.colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            style={[styles.askBtn, { backgroundColor: theme.colors.primary, opacity: !query.trim() || loading ? 0.5 : 1 }]}
            onPress={handleSubmit}
            disabled={!query.trim() || loading}
            activeOpacity={0.85}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.askBtnText}>Sor</Text>}
          </TouchableOpacity>
        </View>
      </View>

      <AppBottomNav active="home" onHome={onBack} />

      <StopDetailSheet
        ref={bottomSheetRef}
        stop={selectedStop}
        distance={selectedStopDistance}
        onLinePress={handleLinePress}
        onClose={() => setSelectedStop(null)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mapCollapsed: {
    flex: 3,
  },
  mapExpanded: {
    flex: 5,
  },
  expandHint: {
    position: 'absolute',
    bottom: 8,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  expandHintText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  collapseBtn: {
    position: 'absolute',
    bottom: 8,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  collapseBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  bottomContainer: {
    padding: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    gap: 8,
  },
  bottomCollapsed: {
    flex: 7,
  },
  bottomExpanded: {
    flex: 5,
  },
  bottomScroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  bottomScrollContent: {
    gap: 8,
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
  },
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
  etaContainer: {
    marginVertical: 4,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    borderRadius: 12,
    paddingLeft: 16,
    paddingRight: 4,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  micBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  askBtn: {
    height: 56,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  askBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
