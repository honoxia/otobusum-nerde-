import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, BackHandler, View } from 'react-native';
import { useFonts } from 'expo-font';
import { MaterialIcons } from '@expo/vector-icons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Toast from 'react-native-toast-message';
import { Buffer } from 'buffer';

import { ThemeProvider } from './src/theme';
import { HomeScreen, AppScreen } from './src/screens/HomeScreen';
import { BusScreen } from './src/screens/BusScreen';
import { TramScreen } from './src/screens/TramScreen';
import { DolmusLinesScreen } from './src/components/Dolmus/DolmusLinesScreen';
import { DolmusMapScreen } from './src/components/Dolmus/DolmusMapScreen';
import dolmusData from './src/data/dolmus-data.json';
import { DolmusLine } from './src/types/shared-types';

global.Buffer = Buffer;

type RoutePlannerComponent = React.ComponentType<{ onBack: () => void }>;

let RoutePlannerScreenComponent: RoutePlannerComponent | null = null;

function getRoutePlannerScreen(): RoutePlannerComponent {
  if (!RoutePlannerScreenComponent) {
    RoutePlannerScreenComponent = require('./src/screens/RoutePlannerScreen').RoutePlannerScreen;
  }

  return RoutePlannerScreenComponent as RoutePlannerComponent;
}

function AppContent() {
  const [screen, setScreen] = useState<AppScreen>('home');
  const [selectedDolmusLines, setSelectedDolmusLines] = useState<DolmusLine[] | null>(null);
  const dolmusLines = useMemo(() => dolmusData as unknown as DolmusLine[], []);

  const goHome = () => {
    setSelectedDolmusLines(null);
    setScreen('home');
  };

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (selectedDolmusLines) {
        setSelectedDolmusLines(null);
        return true;
      }

      if (screen !== 'home') {
        goHome();
        return true;
      }

      return true;
    });

    return () => subscription.remove();
  }, [screen, selectedDolmusLines]);

  if (screen === 'bus') {
    return <BusScreen onBack={goHome} />;
  }

  if (screen === 'dolmus') {
    if (selectedDolmusLines) {
      return <DolmusMapScreen lines={selectedDolmusLines} onBack={() => setSelectedDolmusLines(null)} />;
    }

    return <DolmusLinesScreen lines={dolmusLines} onSelect={setSelectedDolmusLines} onBack={goHome} />;
  }

  if (screen === 'tram') {
    return <TramScreen onBack={goHome} />;
  }

  if (screen === 'route') {
    const RoutePlannerScreen = getRoutePlannerScreen();
    return <RoutePlannerScreen onBack={goHome} />;
  }

  return <HomeScreen onSelect={setScreen} />;
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    ...MaterialIcons.font,
  });

  if (!fontsLoaded && !fontError) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider forcedTheme="dark">
        <AppContent />
        <Toast />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
