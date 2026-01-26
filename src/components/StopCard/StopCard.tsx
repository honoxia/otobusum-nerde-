import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Card, Chip } from '../common';
import { useTheme } from '../../theme';
import { BusStop } from '../../types/shared-types';

interface StopCardProps {
  stop: BusStop;
  distance: number;
  onLinePress?: (line: string) => void;
  selectedLine?: string | null;
}

export const StopCard: React.FC<StopCardProps> = ({
  stop,
  distance,
  onLinePress,
  selectedLine,
}) => {
  const theme = useTheme();

  const formatDistance = (meters: number): string => {
    if (meters < 1000) {
      return `${Math.round(meters)} m`;
    }
    return `${(meters / 1000).toFixed(1)} km`;
  };

  return (
    <Card variant="elevated" padding="md">
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={[styles.icon, { backgroundColor: theme.colors.warning }]}>
            <Text style={styles.iconText}>●</Text>
          </View>
          <View style={styles.titleContainer}>
            <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
              {stop.name}
            </Text>
            <Text style={[styles.distance, { color: theme.colors.textSecondary }]}>
              {formatDistance(distance)} uzaklıkta
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.linesSection}>
        <Text style={[styles.linesLabel, { color: theme.colors.textSecondary }]}>
          Geçen hatlar
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsContainer}
        >
          {stop.lines.map((line) => (
            <Chip
              key={line}
              label={line}
              variant={selectedLine === line ? 'filled' : 'outlined'}
              color="primary"
              size="md"
              selected={selectedLine === line}
              onPress={() => onLinePress?.(line)}
              style={styles.chip}
            />
          ))}
        </ScrollView>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  header: {
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconText: {
    color: '#fff',
    fontSize: 12,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  distance: {
    fontSize: 13,
  },
  linesSection: {
    marginTop: 4,
  },
  linesLabel: {
    fontSize: 12,
    marginBottom: 8,
  },
  chipsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    marginRight: 8,
  },
});
