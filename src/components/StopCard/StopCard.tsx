import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { BusStop } from '../../types/shared-types';

interface StopCardProps {
  stop: BusStop;
  distance: number;
  onLinePress?: (line: string) => void;
  selectedLine?: string | null;
}

function formatDistance(meters: number): string {
  return meters < 1000 ? `${Math.round(meters)}m uzakta` : `${(meters / 1000).toFixed(1)} km uzakta`;
}

export const StopCard: React.FC<StopCardProps> = ({ stop, distance, onLinePress, selectedLine }) => {
  const { colors } = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      <View style={styles.left}>
        <View style={[styles.iconCircle, { backgroundColor: colors.surfaceSecondary }]}>
          <MaterialIcons name="place" size={22} color={colors.primaryLight} />
        </View>
        <View style={styles.textCol}>
          <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>{stop.name}</Text>
          <Text style={[styles.distance, { color: colors.textSecondary }]}>{formatDistance(distance)}</Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        style={styles.chipScroll}
      >
        {stop.lines.map((line) => {
          const active = selectedLine === line;
          return (
            <TouchableOpacity
              key={line}
              onPress={() => onLinePress?.(line)}
              activeOpacity={0.8}
              style={[
                styles.chip,
                active
                  ? { backgroundColor: 'rgba(79, 70, 229, 0.25)' }
                  : { backgroundColor: colors.surfaceSecondary },
              ]}
            >
              <Text style={[styles.chipText, { color: active ? colors.primaryLight : colors.textSecondary }]}>{line}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexShrink: 1,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flexShrink: 1,
  },
  name: {
    fontSize: 14,
    fontWeight: '700',
  },
  distance: {
    fontSize: 12,
    marginTop: 2,
  },
  chipScroll: {
    flexGrow: 0,
    maxWidth: '45%',
  },
  chips: {
    gap: 4,
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
