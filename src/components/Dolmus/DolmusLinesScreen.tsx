import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { AppTopBar } from '../common/AppTopBar';
import { AppBottomNav } from '../common/AppBottomNav';
import { DolmusLine } from '../../types/shared-types';

interface DolmusLinesScreenProps {
  lines: DolmusLine[];
  onSelect: (line: DolmusLine) => void;
  onBack: () => void;
}

export const DolmusLinesScreen: React.FC<DolmusLinesScreenProps> = ({ lines, onSelect, onBack }) => {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style="light" />
      <AppTopBar onBack={onBack} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Dolmuş Hatları</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Güzergah ve hareket saatlerini seçin.</Text>
        </View>

        <View style={styles.list}>
          {lines.map((line) => (
            <TouchableOpacity
              key={line.line}
              style={[styles.row, { backgroundColor: colors.surfaceSecondary }]}
              onPress={() => onSelect(line)}
              activeOpacity={0.85}
            >
              <View style={[styles.iconWrap, { backgroundColor: line.color || colors.primary }]}>
                <MaterialIcons name="airport-shuttle" size={24} color="#FFFFFF" />
              </View>
              <View style={styles.textWrap}>
                <Text style={[styles.lineName, { color: colors.textPrimary }]}>{line.line}</Text>
                <Text style={[styles.lineMeta, { color: colors.textSecondary }]} numberOfLines={1}>
                  {line.firstStop}{line.loop ? ' · halka' : ''}
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={26} color={colors.textTertiary} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <AppBottomNav active="home" onHome={onBack} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 18,
  },
  header: { gap: 6 },
  title: { fontSize: 26, lineHeight: 32, fontWeight: '800' },
  subtitle: { fontSize: 15, lineHeight: 22 },
  list: { gap: 10 },
  row: {
    minHeight: 78,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: { flex: 1, minWidth: 0 },
  lineName: { fontSize: 17, lineHeight: 22, fontWeight: '800' },
  lineMeta: { fontSize: 13, lineHeight: 18, marginTop: 2 },
});
