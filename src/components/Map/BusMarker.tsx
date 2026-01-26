import React, { memo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Marker } from 'react-native-maps';
import { BusPosition } from '../../types/shared-types';

interface BusMarkerProps {
  bus: BusPosition;
  onPress?: () => void;
  isSelected?: boolean;
}

// Otobüs marker'ı - kırmızı daire içinde hat numarası
const BusMarkerComponent: React.FC<BusMarkerProps> = ({ bus, onPress, isSelected }) => {
  // Android'de ilk render için tracksViewChanges=true, sonra false yap
  const [tracksChanges, setTracksChanges] = useState(true);

  useEffect(() => {
    // İlk render'dan sonra tracking'i kapat (performans için)
    const timer = setTimeout(() => {
      setTracksChanges(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  // Unknown hatları gösterme
  if (bus.line === 'Unknown') return null;

  return (
    <Marker
      coordinate={{
        latitude: bus.coordinates.latitude,
        longitude: bus.coordinates.longitude,
      }}
      title={`Hat ${bus.line}`}
      description={`Hız: ${bus.speed ? Math.round(bus.speed) + ' km/h' : 'N/A'}${bus.heading ? ` | Yön: ${Math.round(bus.heading)}°` : ''}`}
      onPress={onPress}
      tracksViewChanges={tracksChanges}
      anchor={{ x: 0.5, y: 0.5 }}
    >
      <View style={[
        styles.markerContainer,
        isSelected && styles.selectedMarker
      ]}>
        <Text style={styles.lineText}>{bus.line}</Text>
      </View>
    </Marker>
  );
};

const styles = StyleSheet.create({
  markerContainer: {
    backgroundColor: '#DC2626',
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 2,
    borderColor: '#fff',
    minWidth: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  selectedMarker: {
    backgroundColor: '#2563EB',
    borderColor: '#fff',
  },
  lineText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
});

export const BusMarker = memo(BusMarkerComponent, (prevProps, nextProps) => {
  return (
    prevProps.bus.deviceId === nextProps.bus.deviceId &&
    prevProps.bus.coordinates.latitude === nextProps.bus.coordinates.latitude &&
    prevProps.bus.coordinates.longitude === nextProps.bus.coordinates.longitude &&
    prevProps.bus.line === nextProps.bus.line &&
    prevProps.isSelected === nextProps.isSelected
  );
});
