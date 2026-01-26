import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Marker } from 'react-native-maps';
import { Coordinates } from '../../types/shared-types';

interface UserMarkerProps {
  coordinates: Coordinates;
}

// Animasyon kaldırıldı - performans için
const UserMarkerComponent: React.FC<UserMarkerProps> = ({ coordinates }) => {
  return (
    <Marker
      coordinate={{
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
      }}
      title="Konumunuz"
      anchor={{ x: 0.5, y: 0.5 }}
    >
      <View style={styles.container}>
        <View style={styles.pulse} />
        <View style={styles.outerCircle}>
          <View style={styles.innerCircle} />
        </View>
      </View>
    </Marker>
  );
};

export const UserMarker = memo(UserMarkerComponent);

const styles = StyleSheet.create({
  container: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulse: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 122, 255, 0.2)',
  },
  outerCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
  },
  innerCircle: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#007AFF',
  },
});
