// Light/Dark renk paletleri
export const lightColors = {
  // Primary
  primary: '#007AFF',
  primaryLight: '#4DA2FF',
  primaryDark: '#0055B3',

  // Semantic
  success: '#34C759',
  warning: '#FF9500',
  error: '#FF3B30',
  info: '#5856D6',

  // Background
  background: '#FFFFFF',
  surface: '#F5F5F7',
  surfaceSecondary: '#E5E5EA',

  // Text
  textPrimary: '#1C1C1E',
  textSecondary: '#8E8E93',
  textTertiary: '#AEAEB2',
  textInverse: '#FFFFFF',

  // Border
  border: '#C6C6C8',
  borderLight: '#E5E5EA',
  divider: '#D1D1D6',

  // Misc
  shadow: 'rgba(0, 0, 0, 0.1)',
  overlay: 'rgba(0, 0, 0, 0.4)',
  transparent: 'transparent',

  // Map specific
  map: {
    user: '#007AFF',
    bus: '#34C759',
    stop: '#FF9500',
    nearestStop: '#FF3B30',
  },
};

export const darkColors = {
  // Primary (OLED-optimized)
  primary: '#0A84FF',
  primaryLight: '#4DA2FF',
  primaryDark: '#0055B3',

  // Semantic
  success: '#30D158',
  warning: '#FF9F0A',
  error: '#FF453A',
  info: '#5E5CE6',

  // Background (OLED black)
  background: '#000000',
  surface: '#1C1C1E',
  surfaceSecondary: '#2C2C2E',

  // Text
  textPrimary: '#FFFFFF',
  textSecondary: '#8E8E93',
  textTertiary: '#636366',
  textInverse: '#1C1C1E',

  // Border
  border: '#38383A',
  borderLight: '#48484A',
  divider: '#38383A',

  // Misc
  shadow: 'rgba(0, 0, 0, 0.3)',
  overlay: 'rgba(0, 0, 0, 0.6)',
  transparent: 'transparent',

  // Map specific
  map: {
    user: '#0A84FF',
    bus: '#30D158',
    stop: '#FF9F0A',
    nearestStop: '#FF453A',
  },
};

export type ThemeColors = typeof lightColors;
