import React from 'react';
import { View, StyleSheet, ViewStyle, DimensionValue } from 'react-native';
import { useTheme } from '../../theme';

interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  variant?: 'text' | 'circular' | 'rectangular';
  style?: ViewStyle;
}

// Basit skeleton - animasyon kaldırıldı performans için
export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 20,
  variant = 'rectangular',
  style,
}) => {
  const theme = useTheme();

  const borderRadius = {
    text: theme.borderRadius.xs,
    circular: typeof height === 'number' ? height / 2 : 9999,
    rectangular: theme.borderRadius.sm,
  }[variant];

  return (
    <View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: theme.colors.surfaceSecondary,
          opacity: 0.5,
        },
        style,
      ]}
    />
  );
};

// Pre-built skeleton compositions
export const SkeletonCard: React.FC = () => {
  const theme = useTheme();

  return (
    <View style={[styles.card, { padding: theme.spacing.lg, backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.md }]}>
      <Skeleton height={16} width="60%" style={{ marginBottom: theme.spacing.sm }} />
      <Skeleton height={24} width="80%" style={{ marginBottom: theme.spacing.md }} />
      <View style={styles.chipRow}>
        <Skeleton height={32} width={60} variant="rectangular" style={{ borderRadius: 16 }} />
        <Skeleton height={32} width={60} variant="rectangular" style={{ borderRadius: 16, marginLeft: theme.spacing.sm }} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
  },
  chipRow: {
    flexDirection: 'row',
  },
});
