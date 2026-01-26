import React, { memo } from 'react';
import { Marker } from 'react-native-maps';
import { BusStop } from '../../types/shared-types';

interface StopMarkerProps {
  stop: BusStop;
  isNearest?: boolean;
  onPress?: () => void;
}

// Durak marker'ı - mavi pin, en yakın turuncu
const StopMarkerComponent: React.FC<StopMarkerProps> = ({
  stop,
  isNearest = false,
  onPress,
}) => {
  return (
    <Marker
      coordinate={{
        latitude: stop.coordinates.latitude,
        longitude: stop.coordinates.longitude,
      }}
      title={stop.name}
      description={`Hatlar: ${stop.lines.slice(0, 5).join(', ')}${stop.lines.length > 5 ? '...' : ''}`}
      onPress={onPress}
      pinColor={isNearest ? 'orange' : 'blue'}
    />
  );
};

export const StopMarker = memo(StopMarkerComponent, (prevProps, nextProps) => {
  return (
    prevProps.stop.id === nextProps.stop.id &&
    prevProps.isNearest === nextProps.isNearest
  );
});
