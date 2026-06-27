import React, { useRef, useEffect, useState } from 'react';
import { StyleSheet, Platform, View, Text, ScrollView, TouchableOpacity } from 'react-native';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import { Coordinates, BusStop, BusPosition } from '../../types/shared-types';
import { MAP_CONFIG } from '../../utils/constants';
import { StopMarker } from './StopMarker';
import { UserMarker } from './UserMarker';
import { BusMarker } from './BusMarker';

interface MapContainerProps {
  userLocation: Coordinates | null;
  stops: BusStop[];
  nearestStopId?: string | null;
  buses?: BusPosition[];
  onStopPress?: (stop: BusStop) => void;
  onBusPress?: (bus: BusPosition) => void;
}

/**
 * Ana harita component'i.
 * Google Maps API key yoksa uygulama haritasiz liste modunda calisir.
 */
export const MapContainer: React.FC<MapContainerProps> = ({
  userLocation,
  stops,
  nearestStopId,
  buses = [],
  onStopPress,
  onBusPress,
}) => {
  const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  const mapRef = useRef<MapView>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [hasZoomedToUser, setHasZoomedToUser] = useState(false);

  const handleMapReady = () => {
    console.log('[MAP] Map is ready');
    setIsMapReady(true);
  };

  useEffect(() => {
    if (isMapReady && mapRef.current && userLocation && !hasZoomedToUser) {
      console.log('[MAP] Zooming to user location:', userLocation);
      setTimeout(() => {
        mapRef.current?.animateToRegion(
          {
            latitude: userLocation.latitude,
            longitude: userLocation.longitude,
            latitudeDelta: 0.008,
            longitudeDelta: 0.008,
          },
          1000
        );
        setHasZoomedToUser(true);
      }, 500);
    }
  }, [isMapReady, userLocation, hasZoomedToUser]);

  useEffect(() => {
    console.log(`[MAP] Rendering ${stops.length} stops, ${buses.length} buses`);
  }, [stops.length, buses.length]);

  if (!googleMapsApiKey) {
    return (
      <View style={styles.fallbackContainer}>
        <View style={styles.fallbackHeader}>
          <Text style={styles.fallbackTitle}>Haritasiz mod</Text>
          <Text style={styles.fallbackSubtitle}>
            Google Maps API key yokken durak ve otobus verileri liste olarak gosterilir.
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
                  style={[
                    styles.listItem,
                    stop.id === nearestStopId && styles.nearestListItem,
                  ]}
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
  }

  return (
    <MapView
      ref={mapRef}
      style={styles.map}
      provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
      initialRegion={MAP_CONFIG.INITIAL_REGION}
      showsUserLocation={false}
      onMapReady={handleMapReady}
    >
      {userLocation && <UserMarker coordinates={userLocation} />}

      {stops.map((stop) => (
        <StopMarker
          key={stop.id}
          stop={stop}
          isNearest={stop.id === nearestStopId}
          onPress={() => onStopPress?.(stop)}
        />
      ))}

      {buses.map((bus) => (
        <BusMarker
          key={bus.deviceId}
          bus={bus}
          onPress={() => onBusPress?.(bus)}
        />
      ))}
    </MapView>
  );
};

const styles = StyleSheet.create({
  map: {
    flex: 1,
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
