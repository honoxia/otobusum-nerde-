import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../theme';

interface AppBottomNavProps {
  /** Aktif sekme */
  active?: 'home' | 'favs' | 'alerts';
  /** "Ana Sayfa"ya dokununca (genelde ana menüye dönüş) */
  onHome?: () => void;
}

// Material 3 ikincil kap renkleri (aktif sekme) — tasarıma özel
const ACTIVE_BG = '#3131C0';
const ACTIVE_FG = '#B0B2FF';

/**
 * Stitch tasarımındaki paylaşılan alt tab bar.
 * Sık Kullanılanlar / Bildirimler şimdilik görsel (işlev sonra eklenecek).
 */
export const AppBottomNav: React.FC<AppBottomNavProps> = ({ active = 'home', onHome }) => {
  const { colors } = useTheme();

  const tabs: Array<{
    key: 'home' | 'favs' | 'alerts';
    label: string;
    icon: React.ComponentProps<typeof MaterialIcons>['name'];
    onPress?: () => void;
  }> = [
    { key: 'home', label: 'Ana Sayfa', icon: 'home', onPress: onHome },
    { key: 'favs', label: 'Sık Kullanılanlar', icon: 'star-outline' },
    { key: 'alerts', label: 'Bildirimler', icon: 'notifications-none' },
  ];

  return (
    <View style={[styles.nav, { backgroundColor: colors.surface, borderTopColor: colors.divider }]}>
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        const fg = isActive ? ACTIVE_FG : colors.textTertiary;
        return (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, isActive && [styles.tabActive, { backgroundColor: ACTIVE_BG }]]}
            onPress={tab.onPress}
            disabled={!tab.onPress}
            activeOpacity={0.8}
          >
            <MaterialIcons name={tab.icon} size={22} color={fg} />
            <Text style={[styles.label, { color: fg }]} numberOfLines={1}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  nav: {
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
  label: {
    fontSize: 12,
    fontWeight: '500',
  },
});
