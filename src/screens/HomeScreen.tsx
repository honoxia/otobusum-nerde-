import React from 'react';
import {
  Image,
  ImageSourcePropType,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../theme';

export type AppScreen = 'home' | 'bus' | 'tram' | 'dolmus' | 'route';

interface HomeScreenProps {
  onSelect: (screen: Exclude<AppScreen, 'home'>) => void;
}

const MENU_ITEMS: Array<{
  key: Exclude<AppScreen, 'home'>;
  title: string;
  subtitle: string;
  icon: ImageSourcePropType;
}> = [
  {
    key: 'tram',
    title: 'Tramvay',
    subtitle: 'Hatlar ve duraklar',
    icon: require('../../assets/menu-icons/tram.png'),
  },
  {
    key: 'bus',
    title: 'Otobüs',
    subtitle: 'Canlı araç ve ETA',
    icon: require('../../assets/menu-icons/bus.png'),
  },
  {
    key: 'dolmus',
    title: 'Dolmuş',
    subtitle: 'Güzergah ve saatler',
    icon: require('../../assets/menu-icons/dolmus.png'),
  },
  {
    key: 'route',
    title: 'Rota',
    subtitle: 'Aktarmalı planla',
    icon: require('../../assets/menu-icons/route.png'),
  },
];

export const HomeScreen: React.FC<HomeScreenProps> = ({ onSelect }) => {
  const theme = useTheme();

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
    >
      <View style={styles.hero}>
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Eskişehir Ulaşım</Text>
      </View>

      <View style={styles.grid}>
        {MENU_ITEMS.map((item) => (
          <TouchableOpacity
            key={item.key}
            style={[
              styles.card,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.borderLight,
              },
            ]}
            onPress={() => onSelect(item.key)}
            activeOpacity={0.78}
          >
            <View style={styles.iconWrap}>
              <Image source={item.icon} style={styles.icon} resizeMode="contain" />
            </View>
            <View style={styles.cardText}>
              <Text style={[styles.cardTitle, { color: theme.colors.textPrimary }]} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={[styles.cardSubtitle, { color: theme.colors.textSecondary }]} numberOfLines={2}>
                {item.subtitle}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingTop: 62,
    paddingHorizontal: 18,
    paddingBottom: 28,
    gap: 24,
  },
  hero: {
    gap: 0,
  },
  title: {
    fontSize: 30,
    fontWeight: '900',
  },
  grid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
  card: {
    width: '48%',
    minHeight: 210,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  iconWrap: {
    width: '100%',
    height: 116,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    width: 112,
    height: 112,
    borderRadius: 24,
  },
  cardText: {
    minHeight: 54,
    alignItems: 'center',
    gap: 4,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  cardSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
});
