import Constants from 'expo-constants';

// Environment variables from .env file (via expo-constants)
const extra = Constants.expoConfig?.extra || {};

export const config = {
  flespi: {
    token: extra.FLESPI_TOKEN || process.env.FLESPI_TOKEN || '',
    channelId: extra.FLESPI_CHANNEL_ID || process.env.FLESPI_CHANNEL_ID || '',
    deviceIds: (extra.FLESPI_DEVICE_IDS || process.env.FLESPI_DEVICE_IDS || '')
      .split(',')
      .filter(Boolean),
  },
  mqtt: {
    broker: extra.MQTT_BROKER || process.env.MQTT_BROKER || 'wss://mqtt.flespi.io',
    port: parseInt(extra.MQTT_PORT || process.env.MQTT_PORT || '443', 10),
  },
  app: {
    maxNearbyStopDistance: parseInt(
      extra.MAX_NEARBY_STOP_DISTANCE || process.env.MAX_NEARBY_STOP_DISTANCE || '1000',
      10
    ),
    defaultBusSpeedKmh: parseInt(
      extra.DEFAULT_BUS_SPEED_KMH || process.env.DEFAULT_BUS_SPEED_KMH || '30',
      10
    ),
    vehiclePositionTtlMs: parseInt(
      extra.VEHICLE_POSITION_TTL_MS || process.env.VEHICLE_POSITION_TTL_MS || '300000',
      10
    ),
  },
  // Wialon Nimbus locator hash (Eskişehir otobüsleri için)
  nimbus: {
    locatorHash: extra.NIMBUS_LOCATOR_HASH || process.env.NIMBUS_LOCATOR_HASH || '4d5af2578d1f42adabc3165aa4456953',
  },
};
