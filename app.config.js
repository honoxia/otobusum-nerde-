import 'dotenv/config';

export default {
  expo: {
    name: "otobusum nerde",
    slug: "otobusum-nerde",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
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
      package: "com.honoxia.otobusumnerde",
      usesCleartextTraffic: false,
      permissions: [
        "ACCESS_COARSE_LOCATION",
        "ACCESS_FINE_LOCATION",
        "RECORD_AUDIO"
      ],
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
        }
      }
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
      MQTT_BROKER: "wss://mqtt.flespi.io",
      MQTT_PORT: "443",
      MAX_NEARBY_STOP_DISTANCE: "1000",
      DEFAULT_BUS_SPEED_KMH: "30",
      VEHICLE_POSITION_TTL_MS: "300000"
    }
  }
};
