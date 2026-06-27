import React, { useMemo, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Toast from 'react-native-toast-message';
import { Buffer } from 'buffer';

import { ThemeProvider } from './src/theme';
import { HomeScreen, AppScreen } from './src/screens/HomeScreen';
import { BusScreen } from './src/screens/BusScreen';
import { TramScreen } from './src/screens/TramScreen';
import { RoutePlannerScreen } from './src/screens/RoutePlannerScreen';
import { DolmusMapScreen } from './src/components/Dolmus/DolmusMapScreen';
import dolmusData from './src/data/dolmus-data.json';
import { DolmusLine } from './src/types/shared-types';

global.Buffer = Buffer;

function AppContent() {
  const [screen, setScreen] = useState<AppScreen>('home');
  const dolmusLines = useMemo(() => dolmusData as unknown as DolmusLine[], []);
  const dolmusLine = dolmusLines[0] ?? null;

  const goHome = () => setScreen('home');

  if (screen === 'bus') {
    return <BusScreen onBack={goHome} />;
  }

  if (screen === 'dolmus') {
    return <DolmusMapScreen line={dolmusLine} onBack={goHome} />;
  }

  if (screen === 'tram') {
    return <TramScreen onBack={goHome} />;
  }

  if (screen === 'route') {
    return <RoutePlannerScreen onBack={goHome} />;
  }

  return <HomeScreen onSelect={setScreen} />;
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <AppContent />
        <Toast />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
