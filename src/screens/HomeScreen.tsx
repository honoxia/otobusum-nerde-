import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { AppTopBar } from '../components/common/AppTopBar';

export type AppScreen = 'home' | 'bus' | 'tram' | 'dolmus' | 'route';

interface HomeScreenProps {
  onSelect: (screen: Exclude<AppScreen, 'home'>) => void;
}

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

const MENU_ITEMS: Array<{
  key: Exclude<AppScreen, 'home'>;
  title: string;
  icon: IconName;
}> = [
  { key: 'bus', title: 'Otobüs', icon: 'directions-bus' },
  { key: 'tram', title: 'Tramvay', icon: 'tram' },
  { key: 'dolmus', title: 'Dolmuş', icon: 'airport-shuttle' },
  { key: 'route', title: 'Güzergah\nPlanla', icon: 'route' },
];

export const HomeScreen: React.FC<HomeScreenProps> = ({ onSelect }) => {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style="light" />
      <AppTopBar />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.welcome}>
          <Text style={[styles.h2, { color: colors.textPrimary }]}>Nereye gitmek istersiniz?</Text>
          <Text style={[styles.sub, { color: colors.textSecondary }]}>Size en uygun ulaşım aracını seçin.</Text>
        </View>

        <View style={styles.grid}>
          {MENU_ITEMS.map((item) => (
            <TouchableOpacity
              key={item.key}
              style={[styles.card, { backgroundColor: colors.surfaceSecondary }]}
              onPress={() => onSelect(item.key)}
              activeOpacity={0.85}
            >
              <View style={styles.badge}>
                <MaterialIcons name={item.icon} size={36} color={colors.primaryLight} />
              </View>
              <Text style={[styles.cardLabel, { color: colors.textPrimary }]}>{item.title}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 24,
  },
  welcome: { gap: 8 },
  h2: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  sub: { fontSize: 16, lineHeight: 24 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  card: {
    width: '47.5%',
    flexGrow: 1,
    aspectRatio: 1,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  badge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(79, 70, 229, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardLabel: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '600',
    textAlign: 'center',
  },
});
