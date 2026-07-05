import React, { useEffect, useState, lazy, Suspense } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Coordinates, BusStop, BusPosition } from '../../types/shared-types';
import { config } from '../../config';
import { OsmMapView } from './OsmMapView';
import { devLog } from '../../utils/devLog';

const GoogleMapView = lazy(() =>
  import('./GoogleMapView').then((module) => ({ default: module.GoogleMapView }))
);

interface MapContainerProps {
  userLocation: Coordinates | null;
  stops: BusStop[];
  nearestStopId?: string | null;
  buses?: BusPosition[];
  onStopPress?: (stop: BusStop) => void;
  onBusPress?: (bus: BusPosition) => void;
}

/**
 * Ana harita component'i. Harita modunu seçer:
 *  - provider 'google' + API key varsa  -> Google Maps
 *  - provider 'osm' veya key yoksa       -> OSM (Leaflet/WebView)
 *  - OSM/WebView yüklenemezse            -> haritasız liste modu (son fallback)
 */
export const MapContainer: React.FC<MapContainerProps> = ({
  userLocation,
  stops,
  nearestStopId,
  buses = [],
  onStopPress,
  onBusPress,
}) => {
  const { provider, googleApiKey } = config.map;
  const useGoogle = provider === 'google' && !!googleApiKey;
  const [osmFailed, setOsmFailed] = useState(false);

  useEffect(() => {
    devLog(
      `[MAP] provider=${provider} useGoogle=${useGoogle} | ${stops.length} stops, ${buses.length} buses`
    );
  }, [provider, useGoogle, stops.length, buses.length]);

  // 1) Google Maps
  if (useGoogle) {
    return (
      <Suspense
        fallback={
          <View style={styles.mapLoading}>
            <ActivityIndicator size="large" />
          </View>
        }
      >
        <GoogleMapView
          userLocation={userLocation}
          stops={stops}
          nearestStopId={nearestStopId}
          buses={buses}
          onStopPress={onStopPress}
          onBusPress={onBusPress}
        />
      </Suspense>
    );
  }

  // 2) OSM (WebView + Leaflet)
  if (!osmFailed) {
    return (
      <OsmMapView
        userLocation={userLocation}
        stops={stops}
        nearestStopId={nearestStopId}
        buses={buses}
        onStopPress={onStopPress}
        onBusPress={onBusPress}
        onError={() => setOsmFailed(true)}
      />
    );
  }

  // 3) Son fallback: haritasız liste modu
  return (
    <View style={styles.fallbackContainer}>
      <View style={styles.fallbackHeader}>
        <Text style={styles.fallbackTitle}>Haritasiz mod</Text>
        <Text style={styles.fallbackSubtitle}>
          Harita yuklenemedi; durak ve otobus verileri liste olarak gosteriliyor.
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.fallbackContent}>
        {userLocation && (
          <View style={styles.locationCard}>
            <Text style={styles.sectionLabel}>Konum</Text>
            <Text style={styles.primaryText}>
              {userLocation.latitude.toFixed(5)}, {userLocation.longitude.toFixed(5)}
            </Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Yakindaki duraklar ({stops.length})</Text>
          {stops.length === 0 ? (
            <Text style={styles.emptyText}>Yakinda durak bulunamadi.</Text>
          ) : (
            stops.slice(0, 12).map((stop) => (
              <TouchableOpacity
                key={stop.id}
                style={[styles.listItem, stop.id === nearestStopId && styles.nearestListItem]}
                onPress={() => onStopPress?.(stop)}
              >
                <Text style={styles.itemTitle}>{stop.name}</Text>
                <Text style={styles.itemMeta} numberOfLines={1}>
                  {stop.lines.join(', ')}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Canli otobusler ({buses.length})</Text>
          {buses.length === 0 ? (
            <Text style={styles.emptyText}>Henuz canli otobus verisi yok.</Text>
          ) : (
            buses.slice(0, 20).map((bus) => (
              <TouchableOpacity
                key={bus.deviceId}
                style={styles.listItem}
                onPress={() => onBusPress?.(bus)}
              >
                <Text style={styles.itemTitle}>Hat {bus.line}</Text>
                <Text style={styles.itemMeta}>
                  {bus.coordinates.latitude.toFixed(5)}, {bus.coordinates.longitude.toFixed(5)}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  mapLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  fallbackContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  fallbackHeader: {
    padding: 16,
    paddingTop: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  fallbackTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  fallbackSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: '#64748B',
  },
  fallbackContent: {
    padding: 12,
    gap: 12,
  },
  locationCard: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  section: {
    gap: 8,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
  },
  primaryText: {
    fontSize: 16,
    color: '#0F172A',
  },
  listItem: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  nearestListItem: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  itemMeta: {
    fontSize: 12,
    color: '#64748B',
  },
  emptyText: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    fontSize: 13,
    color: '#64748B',
  },
});
