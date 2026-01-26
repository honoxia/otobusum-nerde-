// Map Configuration
export const MAP_CONFIG = {
  // Initial region (Eskisehir center)
  INITIAL_REGION: {
    latitude: 39.7767,
    longitude: 30.5206,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  },

  // Marker colors
  COLORS: {
    USER: '#007AFF', // Blue
    STOP: '#FF9500', // Orange
    NEAREST_STOP: '#FF3B30', // Red
    BUS: '#34C759', // Green
  },
};

// App Constants
export const APP_CONSTANTS = {
  // Location refresh interval (ms)
  LOCATION_REFRESH_INTERVAL: 10000, // 10 seconds

  // Max nearby stop distance (meters)
  MAX_NEARBY_STOP_DISTANCE: 1000,

  // Voice recognition language
  VOICE_LANGUAGE: 'tr-TR',

  // Speech synthesis language
  SPEECH_LANGUAGE: 'tr-TR',
};
