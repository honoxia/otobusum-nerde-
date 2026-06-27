import React, { useRef, useEffect, useState } from 'react';
import { StyleSheet, Platform } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { Coordinates, BusStop, BusPosition } from '../../types/shared-types';
import { MAP_CONFIG } from '../../utils/constants';
import { StopMarker } from './StopMarker';
import { UserMarker } from './UserMarker';
import { BusMarker } from './BusMarker';
import { devLog } from '../../utils/devLog';
import tramData from '../../data/tram-data.json';

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
    devLog('[MAP] Map is ready');
    setIsMapReady(true);
  };

  useEffect(() => {
    if (isMapReady && mapRef.current && userLocation && !hasZoomedToUser) {
      devLog('[MAP] Zooming to user location:', userLocation);
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
    devLog(`[MAP] Rendering ${stops.length} stops, ${buses.length} buses`);
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

      {tramData.lines.flatMap((line) =>
        line.paths.map((path, index) => (
          <Polyline
            key={`${line.id}_${index}_halo`}
            coordinates={path}
            strokeColor="#FFFFFF"
            strokeWidth={7}
            zIndex={1}
          />
        ))
      )}

      {tramData.lines.flatMap((line) =>
        line.paths.map((path, index) => (
          <Polyline
            key={`${line.id}_${index}`}
            coordinates={path}
            strokeColor={line.color}
            strokeWidth={4}
            zIndex={2}
          />
        ))
      )}

      {tramData.stops.map((stop) => (
        <Marker
          key={stop.id}
          coordinate={stop.coordinates}
          title={stop.name}
          description={stop.lines.length ? `Tramvay: ${stop.lines.join(', ')}` : 'Tramvay durağı'}
          pinColor="#E11D48"
          zIndex={3}
        />
      ))}

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
