import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  useColorScheme,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Speech from 'expo-speech';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Toast from 'react-native-toast-message';

import { ThemeProvider, useTheme } from './src/theme';
import { MapContainer } from './src/components/Map/MapContainer';
import { StopCard } from './src/components/StopCard/StopCard';
import { ETACard } from './src/components/ETACard/ETACard';
import { StopDetailSheet, StopDetailSheetRef } from './src/components/BottomSheet/StopDetailSheet';
import { Button } from './src/components/common';
import { SkeletonCard } from './src/components/common/Skeleton';

import { useLocation } from './src/hooks/useLocation';
import { useStops } from './src/hooks/useStops';
import { useNearestStop } from './src/hooks/useNearestStop';
import { useLiveVehicles } from './src/hooks/useLiveVehicles';
import etaService from './src/services/ETAService';
import { extractLineNumber } from './src/utils/queryParser';
import { ETAResult, BusStop } from './src/types/shared-types';
import { calculateHaversineDistance } from './src/utils/geo.utils';
import { Buffer } from 'buffer';
global.Buffer = Buffer;

// Voice recognition (optional)
let sttAvailable = false;
let Voice: any = null;

try {
  Voice = require('@react-native-voice/voice').default;
  sttAvailable = true;
} catch {
  sttAvailable = false;
}

// Main App Content (with theme access)
function AppContent() {
  const theme = useTheme();
  const bottomSheetRef = useRef<StopDetailSheetRef>(null);

  // State
  const [query, setQuery] = useState('');
  const [etaResult, setEtaResult] = useState<ETAResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [sttEnabled] = useState(sttAvailable);
  const [selectedStop, setSelectedStop] = useState<BusStop | null>(null);
  const [selectedStopDistance, setSelectedStopDistance] = useState<number>(0);
  const [selectedLine, setSelectedLine] = useState<string | null>(null);

  // Hooks
  const { location, error: locationError, isLoading: locationLoading } = useLocation();
  const { stops: allStops, isLoading: stopsLoading } = useStops();
  const { nearestStop } = useNearestStop(location);
  const { vehicles: buses, isConnected, connectionStatus } = useLiveVehicles();

  // Sadece 500m çaptaki durakları göster (performans için)
  const nearbyStops = React.useMemo(() => {
    if (!location || !allStops.length) {
      console.log('[APP] nearbyStops: No location or stops', { location: !!location, stopsCount: allStops.length });
      return [];
    }
    const nearby = allStops.filter(stop => {
      const dist = calculateHaversineDistance(location, stop.coordinates);
      return dist <= 1000; // 1000 metre (test için artırıldı)
    });
    console.log(`[APP] 📍 nearbyStops: ${nearby.length} durak (1000m içinde), toplam: ${allStops.length}`);
    // İlk 3 durağı logla
    nearby.slice(0, 3).forEach(s => {
      console.log(`[APP]    - ${s.name} (${s.lines.join(', ')})`);
    });
    return nearby;
  }, [location, allStops]);

  // Voice recognition setup
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
      console.log('Voice setup failed');
    }

    return () => {
      try {
        Voice.destroy().then(() => Voice.removeAllListeners());
      } catch { }
    };
  }, []);

  // Voice controls
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

  // TTS
  const speakText = (text: string) => {
    Speech.speak(text, {
      language: 'tr-TR',
    });
  };

  // Show toast
  const showToast = (type: 'success' | 'error' | 'info', title: string, message?: string) => {
    Toast.show({
      type,
      text1: title,
      text2: message,
      position: 'top',
      visibilityTime: 3000,
    });
  };

  // ETA Query Handler
  const handleQuery = useCallback(
    async (text: string) => {
      if (!location) {
        const msg = 'Konum bilgisi alınamadı.';
        setEtaResult({ status: 'error', errorMessage: msg });
        showToast('error', 'Hata', msg);
        speakText(msg);
        return;
      }

      const line = extractLineNumber(text);
      if (!line) {
        const msg = 'Hat numarası anlaşılamadı.';
        setEtaResult({ status: 'error', errorMessage: msg });
        showToast('error', 'Hata', msg);
        speakText(msg);
        return;
      }

      setLoading(true);
      setEtaResult(null);
      setSelectedLine(line);

      try {
        // Async versiyon - Nimbus fallback ile
        const result = await etaService.calculateETAWithSchedule(location, line, buses);
        setEtaResult(result);

        // TTS response
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
    [location, buses]
  );

  const handleSubmit = () => {
    if (query.trim()) {
      handleQuery(query.trim());
    }
  };

  // Handle line press from StopCard
  const handleLinePress = (line: string) => {
    setQuery(line);
    setSelectedLine(line);
    handleQuery(line);
  };

  // Handle stop press on map
  const handleStopPress = (stop: BusStop) => {
    setSelectedStop(stop);
    if (location) {
      const dist = calculateHaversineDistance(location, stop.coordinates);
      setSelectedStopDistance(dist);
    }
    bottomSheetRef.current?.snapToIndex(0);
  };

  // Close bottom sheet
  const handleSheetClose = () => {
    setSelectedStop(null);
  };

  const isLoading = locationLoading || stopsLoading;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />

      {/* Map */}
      <View style={styles.mapContainer}>
        {isLoading ? (
          <View style={[styles.mapPlaceholder, { backgroundColor: theme.colors.surface }]}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
              Yükleniyor...
            </Text>
          </View>
        ) : locationError ? (
          <View style={[styles.mapPlaceholder, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.errorText, { color: theme.colors.error }]}>
              {locationError}
            </Text>
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
      </View>

      {/* Bottom Panel */}
      <View style={[styles.bottomContainer, { backgroundColor: theme.colors.background, borderTopColor: theme.colors.border }]}>
        {/* Kaydırılabilir kart alanı (harita için yükseklik tavanı) */}
        <ScrollView
          style={styles.bottomScroll}
          contentContainerStyle={styles.bottomScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Real-time Connection Status */}
          <View style={styles.statusRow}>
            <View style={[
              styles.statusDot,
              { backgroundColor: isConnected ? theme.colors.success : theme.colors.error }
            ]} />
            <Text style={[styles.statusText, { color: theme.colors.textSecondary }]}>
              {isConnected ? `Canlı: ${buses.length} otobüs` : connectionStatus === 'connecting' ? 'Bağlanıyor...' : 'Bağlantı yok'}
            </Text>
          </View>

          {/* Nearest Stop Card */}
          {isLoading ? (
            <SkeletonCard />
          ) : nearestStop?.stop && (
            <StopCard
              stop={nearestStop.stop}
              distance={nearestStop.distance}
              onLinePress={handleLinePress}
              selectedLine={selectedLine}
            />
          )}

          {/* ETA Result */}
          {etaResult && (
            <View style={styles.etaContainer}>
              <ETACard result={etaResult} />
            </View>
          )}
        </ScrollView>

        {/* Query Input */}
        <View style={styles.inputRow}>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                color: theme.colors.textPrimary,
              }
            ]}
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
              style={[
                styles.micButton,
                { backgroundColor: isListening ? theme.colors.error : theme.colors.primary }
              ]}
              onPressIn={startListening}
              onPressOut={stopListening}
              disabled={loading}
            >
              <Text style={styles.micButtonText}>
                {isListening ? '...' : '🎤'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Submit Button */}
        <Button
          onPress={handleSubmit}
          loading={loading}
          disabled={!query.trim()}
          fullWidth
        >
          Sor
        </Button>
      </View>

      {/* Bottom Sheet for Stop Details */}
      <StopDetailSheet
        ref={bottomSheetRef}
        stop={selectedStop}
        distance={selectedStopDistance}
        onLinePress={handleLinePress}
        onClose={handleSheetClose}
      />

      {/* Toast Container */}
      <Toast />
    </View>
  );
}

// Main App with Providers
export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mapContainer: {
    flex: 1,
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
    // Alt panel ekranın yarısını geçmesin; kalan yer haritaya gider
    maxHeight: '55%',
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
  etaContainer: {
    marginVertical: 4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  micButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  micButtonText: {
    fontSize: 20,
  },
});
