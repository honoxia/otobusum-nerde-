import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
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
          <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={2}>{stop.name}</Text>
          <Text style={[styles.distance, { color: colors.textSecondary }]}>{formatDistance(distance)}</Text>
        </View>
      </View>

      <View style={styles.chips}>
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
              <Text
                style={[styles.chipText, { color: active ? colors.primaryLight : colors.textSecondary }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
                maxFontSizeMultiplier={1.15}
              >
                {line}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 190,
    minWidth: 0,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  name: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
  },
  distance: {
    fontSize: 12,
    marginTop: 2,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexShrink: 1,
    flexGrow: 1,
    flexBasis: 96,
  },
  chip: {
    minWidth: 44,
    maxWidth: 64,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 6,
  },
  chipText: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
  },
});
