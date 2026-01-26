import React, { useRef, useEffect, useState } from 'react';
import { StyleSheet, Platform, View, Text } from 'react-native';
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
 * Ana Harita Component
 * INPUT: User location, stops, nearest stop, buses
 * OUTPUT: Rendered map with markers
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

  // Harita hazır olduğunda
  const handleMapReady = () => {
    console.log('[MAP] ✅ Map is ready');
    setIsMapReady(true);
  };

  // Harita hazır ve konum geldiğinde zoom yap (sadece 1 kez)
  useEffect(() => {
    if (isMapReady && mapRef.current && userLocation && !hasZoomedToUser) {
      console.log('[MAP] 📍 Zooming to user location:', userLocation);
      // Küçük bir gecikme ekle (haritanın tamamen yüklenmesi için)
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

  // Debug: stops sayısını logla
  useEffect(() => {
    console.log(`[MAP] 🚏 Rendering ${stops.length} stops, ${buses.length} buses`);
  }, [stops.length, buses.length]);

  if (!googleMapsApiKey) {
    return (
      <View style={styles.warningContainer}>
        <Text style={styles.warningText}>
          Google Maps API key yok. .env dosyasına EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ekleyin.
        </Text>
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
      {/* Kullanıcı Konumu */}
      {userLocation && <UserMarker coordinates={userLocation} />}

      {/* Duraklar */}
      {stops.map((stop) => (
        <StopMarker
          key={stop.id}
          stop={stop}
          isNearest={stop.id === nearestStopId}
          onPress={() => onStopPress?.(stop)}
        />
      ))}

      {/* Otobüsler (Real-time) */}
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
  warningContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  warningText: {
    textAlign: 'center',
    fontSize: 16,
  },
});
