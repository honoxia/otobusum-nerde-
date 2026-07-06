import 'dotenv/config';

const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

export default {
  expo: {
    name: "Eskişehir Ulaşım Rehberi",
    slug: "otobusum-nerde",
    version: "1.0.1",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "dark",
    newArchEnabled: true,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    plugins: [
      "expo-font",
      [
        "expo-location",
        {
          locationWhenInUsePermission: "Konumunuz en yakın durağı bulmak için kullanılır."
        }
      ]
    ],
    ios: {
      supportsTablet: true,
      infoPlist: {
        NSLocationWhenInUseUsageDescription: "Konumunuz en yakın durağı bulmak için kullanılır.",
        NSMicrophoneUsageDescription: "Hat numarası söyleyerek arama yapmak için mikrofon kullanılır."
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      allowBackup: false,
      package: "com.honoxia.otobusumnerde",
      usesCleartextTraffic: false,
      permissions: [
        "ACCESS_COARSE_LOCATION",
        "ACCESS_FINE_LOCATION",
        "INTERNET",
        "RECORD_AUDIO"
      ],
      blockedPermissions: [
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE",
        "android.permission.SYSTEM_ALERT_WINDOW"
      ],
      ...(googleMapsApiKey
        ? {
            config: {
              googleMaps: {
                apiKey: googleMapsApiKey
              }
            }
          }
        : {})
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    extra: {
      eas: {
        projectId: "6706d3a3-1f40-4f73-8272-48f983ed8d92"
      },
      FLESPI_CHANNEL_ID: process.env.FLESPI_CHANNEL_ID || "",
      FLESPI_DEVICE_IDS: process.env.FLESPI_DEVICE_IDS || "",
      NIMBUS_LOCATOR_HASH: process.env.NIMBUS_LOCATOR_HASH || "",
      TRAM_NIMBUS_LOCATOR_HASH: process.env.EXPO_PUBLIC_TRAM_NIMBUS_LOCATOR_HASH || "",
      EXPO_PUBLIC_MAP_PROVIDER: process.env.EXPO_PUBLIC_MAP_PROVIDER || "osm",
      EXPO_PUBLIC_GOOGLE_MAPS_API_KEY: googleMapsApiKey,
      MQTT_BROKER: "wss://mqtt.flespi.io",
      MQTT_PORT: "443",
      MAX_NEARBY_STOP_DISTANCE: "1000",
      DEFAULT_BUS_SPEED_KMH: "30",
      VEHICLE_POSITION_TTL_MS: "300000"
    }
  }
};
