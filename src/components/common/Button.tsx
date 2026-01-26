import React, { ReactNode } from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle } from 'react-native';
import { useTheme } from '../../theme';

interface ButtonProps {
  children: ReactNode;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  style,
}) => {
  const theme = useTheme();

  const isDisabled = disabled || loading;

  const sizeStyles = {
    sm: {
      height: 36,
      paddingHorizontal: theme.spacing.md,
      fontSize: theme.fontSize.sm,
    },
    md: {
      height: theme.componentHeight.button,
      paddingHorizontal: theme.spacing.xl,
      fontSize: theme.fontSize.lg,
    },
    lg: {
      height: 56,
      paddingHorizontal: theme.spacing.xxl,
      fontSize: theme.fontSize.xl,
    },
  }[size];

  const variantStyles: {
    container: ViewStyle;
    textColor: string;
  } = {
    primary: {
      container: {
        backgroundColor: isDisabled ? theme.colors.textTertiary : theme.colors.primary,
      },
      textColor: theme.colors.textInverse,
    },
    secondary: {
      container: {
        backgroundColor: isDisabled ? theme.colors.surfaceSecondary : theme.colors.surface,
      },
      textColor: theme.colors.primary,
    },
    outline: {
      container: {
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderColor: isDisabled ? theme.colors.textTertiary : theme.colors.primary,
      },
      textColor: isDisabled ? theme.colors.textTertiary : theme.colors.primary,
    },
    ghost: {
      container: {
        backgroundColor: 'transparent',
      },
      textColor: isDisabled ? theme.colors.textTertiary : theme.colors.primary,
    },
  }[variant];

  return (
    <TouchableOpacity
      style={[
        styles.button,
        {
          height: sizeStyles.height,
          paddingHorizontal: sizeStyles.paddingHorizontal,
          borderRadius: theme.borderRadius.sm,
        },
        variantStyles.container,
        fullWidth && styles.fullWidth,
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variantStyles.textColor} />
      ) : (
        <Text
          style={[
            styles.text,
            {
              color: variantStyles.textColor,
              fontSize: sizeStyles.fontSize,
              fontWeight: theme.fontWeight.semibold,
            },
          ]}
        >
          {children}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: {
    width: '100%',
  },
  text: {
    textAlign: 'center',
  },
});
