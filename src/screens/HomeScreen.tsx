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

export type AppScreen = 'home' | 'bus' | 'tram' | 'dolmus' | 'route';

interface HomeScreenProps {
  onSelect: (screen: Exclude<AppScreen, 'home'>) => void;
}

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

const MENU_ITEMS: Array<{
  key: Exclude<AppScreen, 'home'>;
  title: string;
  subtitle: string;
  icon: IconName;
  accent: 'primary' | 'success' | 'warning' | 'info';
}> = [
  { key: 'bus', title: 'Otobüs', subtitle: 'Canlı varış · ETA', icon: 'directions-bus', accent: 'primary' },
  { key: 'tram', title: 'Tramvay', subtitle: 'ESTRAM hatları', icon: 'tram', accent: 'success' },
  { key: 'dolmus', title: 'Dolmuş', subtitle: 'Güzergah & saat', icon: 'local-taxi', accent: 'warning' },
  { key: 'route', title: 'Güzergah Planla', subtitle: "A'dan B'ye rota", icon: 'alt-route', accent: 'info' },
];

export const HomeScreen: React.FC<HomeScreenProps> = ({ onSelect }) => {
  const theme = useTheme();
  const c = theme.colors;

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Başlık */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <View style={styles.locationRow}>
              <MaterialIcons name="location-on" size={16} color={c.primary} />
              <Text style={[styles.locationText, { color: c.textSecondary }]}>Eskişehir · Odunpazarı</Text>
            </View>
            <Text style={[styles.title, { color: c.textPrimary }]}>Nereye{'\n'}gidiyorsun?</Text>
          </View>
          <View style={[styles.avatar, { backgroundColor: c.surfaceSecondary }]}>
            <MaterialIcons name="person" size={24} color={c.textSecondary} />
          </View>
        </View>

        {/* Arama pill (otobüs aramaya götürür) */}
        <TouchableOpacity
          style={[styles.searchPill, { backgroundColor: c.surface, borderColor: c.border }]}
          activeOpacity={0.8}
          onPress={() => onSelect('bus')}
        >
          <MaterialIcons name="search" size={22} color={c.textTertiary} />
          <Text style={[styles.searchText, { color: c.textTertiary }]}>Hat, durak veya adres ara</Text>
        </TouchableOpacity>

        {/* 2x2 kart grid */}
        <View style={styles.grid}>
          {MENU_ITEMS.map((item) => {
            const accent = c[item.accent];
            return (
              <TouchableOpacity
                key={item.key}
                style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}
                onPress={() => onSelect(item.key)}
                activeOpacity={0.85}
              >
                <View style={[styles.iconTile, { backgroundColor: accent + '29' }]}>
                  <MaterialIcons name={item.icon} size={30} color={accent} />
                </View>
                <View>
                  <Text style={[styles.cardTitle, { color: c.textPrimary }]}>{item.title}</Text>
                  <Text style={[styles.cardSubtitle, { color: c.textSecondary }]}>{item.subtitle}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  locationText: {
    fontSize: 13,
    fontWeight: '500',
  },
  title: {
    marginTop: 8,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.5,
    lineHeight: 30,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  searchText: {
    fontSize: 15,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  card: {
    width: '47.5%',
    flexGrow: 1,
    minHeight: 142,
    borderWidth: 1,
    borderRadius: 22,
    padding: 18,
    justifyContent: 'space-between',
  },
  iconTile: {
    width: 50,
    height: 50,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  cardSubtitle: {
    marginTop: 3,
    fontSize: 13,
  },
});
