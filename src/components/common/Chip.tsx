import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../theme';

interface ChipProps {
  label: string;
  onPress?: () => void;
  variant?: 'filled' | 'outlined';
  color?: 'primary' | 'success' | 'warning' | 'error';
  size?: 'sm' | 'md';
  selected?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

export const Chip: React.FC<ChipProps> = ({
  label,
  onPress,
  variant = 'filled',
  color = 'primary',
  size = 'md',
  selected = false,
  disabled = false,
  style,
}) => {
  const theme = useTheme();

  const colorValue = theme.colors[color];

  const chipStyle: ViewStyle = variant === 'filled' || selected
    ? { backgroundColor: colorValue }
    : { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colorValue };

  const textColor = variant === 'filled' || selected
    ? theme.colors.textInverse
    : colorValue;

  const sizeStyles = {
    sm: {
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      fontSize: theme.fontSize.sm,
    },
    md: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      fontSize: theme.fontSize.md,
    },
  }[size];

  return (
    <TouchableOpacity
      style={[
        styles.chip,
        chipStyle,
        {
          borderRadius: theme.borderRadius.full,
          paddingHorizontal: sizeStyles.paddingHorizontal,
          paddingVertical: sizeStyles.paddingVertical,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
      onPress={onPress}
      disabled={disabled || !onPress}
      activeOpacity={0.7}
    >
      <Text
        style={[
          styles.label,
          {
            color: textColor,
            fontSize: sizeStyles.fontSize,
            fontWeight: theme.fontWeight.semibold,
          },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    textAlign: 'center',
  },
});
