import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../theme';

interface AppTopBarProps {
  /** Sol ikon: alt ekranlarda geri, ana menüde hamburger */
  onBack?: () => void;
  leftIcon?: React.ComponentProps<typeof MaterialIcons>['name'];
}

/**
 * Paylaşılan üst app bar: sol ikon · uygulama markası · erişilebilirlik.
 */
export const AppTopBar: React.FC<AppTopBarProps> = ({ onBack, leftIcon }) => {
  const { colors } = useTheme();

  return (
    <View style={styles.bar}>
      {onBack ? (
        <TouchableOpacity style={styles.iconBtn} onPress={onBack} activeOpacity={0.7}>
          <MaterialIcons name={leftIcon ?? 'arrow-back'} size={24} color={colors.textSecondary} />
        </TouchableOpacity>
      ) : (
        <View style={styles.iconBtn} />
      )}
      <Text style={[styles.brand, { color: colors.primaryLight }]}>Ulaşım Rehberi</Text>
      <View style={styles.iconBtn} />
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    paddingTop: 52,
    height: 96,
    paddingHorizontal: 20,
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
});
