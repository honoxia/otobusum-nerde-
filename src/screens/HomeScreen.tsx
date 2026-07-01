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

// Material 3 ikincil kap renkleri (aktif tab) — tasarıma özel, temada yok
const ACTIVE_TAB_BG = '#3131C0';
const ACTIVE_TAB_FG = '#B0B2FF';

const MENU_ITEMS: Array<{
  key: Exclude<AppScreen, 'home'>;
  title: string;
  icon: IconName;
  twoLine?: boolean;
}> = [
  { key: 'bus', title: 'Otobüs', icon: 'directions-bus' },
  { key: 'tram', title: 'Tramvay', icon: 'tram' },
  { key: 'dolmus', title: 'Dolmuş', icon: 'airport-shuttle' },
  { key: 'route', title: 'Güzergah\nPlanla', icon: 'route', twoLine: true },
];

export const HomeScreen: React.FC<HomeScreenProps> = ({ onSelect }) => {
  const theme = useTheme();
  const c = theme.colors;

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />

      {/* Üst app bar */}
      <View style={styles.topBar}>
        <View style={styles.iconBtn}>
          <MaterialIcons name="menu" size={24} color={c.textSecondary} />
        </View>
        <Text style={[styles.brand, { color: c.primaryLight }]}>ESULAŞ</Text>
        <View style={styles.iconBtn}>
          <MaterialIcons name="accessibility-new" size={24} color={c.primaryLight} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Karşılama */}
        <View style={styles.welcome}>
          <Text style={[styles.h2, { color: c.textPrimary }]}>Nereye gitmek istersiniz?</Text>
          <Text style={[styles.sub, { color: c.textSecondary }]}>Size en uygun ulaşım aracını seçin.</Text>
        </View>

        {/* 2x2 grid */}
        <View style={styles.grid}>
          {MENU_ITEMS.map((item) => (
            <TouchableOpacity
              key={item.key}
              style={[styles.card, { backgroundColor: c.surfaceSecondary }]}
              onPress={() => onSelect(item.key)}
              activeOpacity={0.85}
            >
              <View style={styles.badge}>
                <MaterialIcons name={item.icon} size={36} color={c.primaryLight} />
              </View>
              <Text style={[styles.cardLabel, { color: c.textPrimary }]}>{item.title}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Alt tab bar */}
      <View style={[styles.bottomNav, { backgroundColor: c.surface, borderTopColor: c.divider }]}>
        <View style={[styles.tab, styles.tabActive, { backgroundColor: ACTIVE_TAB_BG }]}>
          <MaterialIcons name="home" size={22} color={ACTIVE_TAB_FG} />
          <Text style={[styles.tabLabel, { color: ACTIVE_TAB_FG }]}>Ana Sayfa</Text>
        </View>
        <View style={styles.tab}>
          <MaterialIcons name="star-outline" size={22} color={c.textTertiary} />
          <Text style={[styles.tabLabel, { color: c.textTertiary }]}>Sık Kullanılanlar</Text>
        </View>
        <View style={styles.tab}>
          <MaterialIcons name="notifications-none" size={22} color={c.textTertiary} />
          <Text style={[styles.tabLabel, { color: c.textTertiary }]}>Bildirimler</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    paddingTop: 52,
    paddingHorizontal: 20,
    height: 96,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 24,
  },
  welcome: {
    gap: 8,
  },
  h2: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
  },
  sub: {
    fontSize: 16,
    lineHeight: 24,
  },
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
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 24,
    borderTopWidth: 1,
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  tabActive: {
    paddingHorizontal: 18,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
});
