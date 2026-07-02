import React, { useMemo, useState } from 'react';
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
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { AppTopBar } from '../components/common/AppTopBar';
import { AppBottomNav } from '../components/common/AppBottomNav';
import { useLocation } from '../hooks/useLocation';
import journeyPlanner, { Journey, JourneyLeg, JourneyStop } from '../services/routing/JourneyPlanner';
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
  const [query, setQuery] = useState('');
  const [destination, setDestination] = useState<Destination | null>(null);
  const { location, error: locationError, isLoading: locationLoading } = useLocation();

  const suggestions = useMemo(() => journeyPlanner.searchStops(query, 8), [query]);
  const journeys = useMemo(() => {
    if (!location || !destination) return [];
    return journeyPlanner.plan(location, destination.coordinates, 3);
  }, [location, destination]);

  const handleDestinationSelect = (stop: JourneyStop) => {
    setDestination({ name: stop.name, coordinates: stop.coordinates });
    setQuery(stop.name);
  };

  const originText = locationLoading ? 'Konum alınıyor...' : locationError ? 'Konum yok' : 'Mevcut Konumum';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style="light" />
      <AppTopBar onBack={onBack} />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Nereden / Nereye kartı */}
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

        {/* Bağlam çipleri */}
        <View style={styles.chipRow}>
          <View style={[styles.chip, { backgroundColor: colors.primary }]}>
            <MaterialIcons name="schedule" size={16} color="#FFFFFF" />
            <Text style={[styles.chipText, { color: '#FFFFFF' }]}>Şimdi Çık</Text>
          </View>
          <View style={[styles.chip, styles.chipOutline, { borderColor: colors.border }]}>
            <Text style={[styles.chipText, { color: colors.textSecondary }]}>Seçenekler</Text>
          </View>
        </View>

        {/* Öneriler (yazarken) */}
        {!!query.trim() && !destination && suggestions.length > 0 && (
          <View style={[styles.suggestions, { backgroundColor: colors.surface }]}>
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
          </View>
        )}

        {/* Önerilen güzergahlar */}
        {destination && (
          <>
            <Text style={[styles.h2, { color: colors.textPrimary }]}>Önerilen Güzergahlar</Text>

            {locationLoading && (
              <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
            )}

            {!locationLoading && journeys.length === 0 && (
              <Text style={[styles.info, { color: colors.textSecondary }]}>
                Bu hedef için uygun direkt veya tek aktarmalı seçenek bulunamadı.
              </Text>
            )}

            {journeys.map((journey, index) => (
              <JourneyCard key={`${journey.score}-${index}`} journey={journey} fastest={index === 0} />
            ))}
          </>
        )}
      </ScrollView>

      <AppBottomNav active="home" onHome={onBack} />
    </View>
  );
};

const JourneyCard: React.FC<{ journey: Journey; fastest: boolean }> = ({ journey, fastest }) => {
  const { colors } = useTheme();
  const accent = fastest ? colors.primary : colors.warning;
  const now = new Date();
  const end = new Date(now.getTime() + journey.totalApproxMin * 60000);

  return (
    <View style={[styles.routeCard, { backgroundColor: colors.surface, borderLeftColor: accent }]}>
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

      {/* Rota zaman çizelgesi */}
      <View style={styles.timeline}>
        {journey.legs.map((leg, i) => (
          <React.Fragment key={`${leg.type}-${i}`}>
            {i > 0 && <MaterialIcons name="chevron-right" size={16} color={colors.textTertiary} />}
            <LegChip leg={leg} />
          </React.Fragment>
        ))}
      </View>

      <View style={styles.detailRow}>
        <Text style={[styles.detailText, { color: colors.primaryLight }]}>Detayları Gör</Text>
        <MaterialIcons name="arrow-forward" size={16} color={colors.primaryLight} />
      </View>
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
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24, gap: 16 },
  planCard: {
    borderRadius: 12,
    padding: 4,
    position: 'relative',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    height: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  inputText: {
    flex: 1,
    fontSize: 16,
  },
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
  chipOutline: { borderWidth: 1 },
  chipText: { fontSize: 14, fontWeight: '700' },
  suggestions: { borderRadius: 12, overflow: 'hidden' },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  suggestionName: { fontSize: 15, fontWeight: '600' },
  suggestionMeta: { fontSize: 12, marginTop: 1 },
  h2: { fontSize: 20, fontWeight: '600', marginTop: 4 },
  info: { fontSize: 14, lineHeight: 20 },
  center: { paddingVertical: 20, alignItems: 'center' },
  routeCard: {
    borderRadius: 12,
    borderLeftWidth: 4,
    padding: 16,
    gap: 12,
  },
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
  detailRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  detailText: { fontSize: 12, fontWeight: '500' },
});
