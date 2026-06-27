import React, { useRef, useEffect, useState } from 'react';
import { StyleSheet, Platform } from 'react-native';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import { Coordinates, BusStop, BusPosition } from '../../types/shared-types';
import { MAP_CONFIG } from '../../utils/constants';
import { StopMarker } from './StopMarker';
import { UserMarker } from './UserMarker';
import { BusMarker } from './BusMarker';

interface GoogleMapViewProps {
  userLocation: Coordinates | null;
  stops: BusStop[];
  nearestStopId?: string | null;
  buses?: BusPosition[];
  onStopPress?: (stop: BusStop) => void;
  onBusPress?: (bus: BusPosition) => void;
}

/**
 * Google Maps tabanlı harita (react-native-maps).
 * Sadece EXPO_PUBLIC_GOOGLE_MAPS_API_KEY mevcutken kullanılır.
 */
export const GoogleMapView: React.FC<GoogleMapViewProps> = ({
  userLocation,
  stops,
  nearestStopId,
  buses = [],
  onStopPress,
  onBusPress,
}) => {
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
        <BusMarker key={bus.deviceId} bus={bus} onPress={() => onBusPress?.(bus)} />
      ))}
    </MapView>
  );
};

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
});
