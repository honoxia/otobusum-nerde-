// Light/Dark renk paletleri — "Eskişehir Ulaşım" tasarım sistemine göre
// (mor vurgu #8A73FF, koyu mavi-siyah zeminler, yeşil/turuncu/kırmızı durum renkleri)

export const lightColors = {
  // Primary (mor vurgu — açık zeminde biraz daha koyu ton)
  primary: '#7458F5',
  primaryLight: '#8A73FF',
  primaryDark: '#5B3DF0',

  // Semantic
  success: '#20B877',
  warning: '#E8871E',
  error: '#F0325A',
  info: '#2E97F0',

  // Background
  background: '#F4F6FA',
  surface: '#FFFFFF',
  surfaceSecondary: '#E6E8EC',

  // Text
  textPrimary: '#0B0D12',
  textSecondary: '#656C7A',
  textTertiary: '#9AA1B0',
  textInverse: '#FFFFFF',

  // Border
  border: '#E6E8EC',
  borderLight: '#EEF0F4',
  divider: '#E6E8EC',

  // Misc
  shadow: 'rgba(11, 13, 18, 0.08)',
  overlay: 'rgba(8, 9, 12, 0.35)',
  transparent: 'transparent',

  // Map specific
  map: {
    user: '#3BA9FF',
    bus: '#7458F5',
    stop: '#E8871E',
    nearestStop: '#F0325A',
  },
};

export const darkColors = {
  // Primary (mor vurgu)
  primary: '#8A73FF',
  primaryLight: '#A594FF',
  primaryDark: '#5B3DF0',

  // Semantic
  success: '#2FD08A',
  warning: '#FFA23C',
  error: '#FF5470',
  info: '#3BA9FF',

  // Background (koyu mavi-siyah)
  background: '#08090C',
  surface: '#161922',
  surfaceSecondary: '#1F2430',

  // Text
  textPrimary: '#F4F6FA',
  textSecondary: '#9AA1B0',
  textTertiary: '#656C7A',
  textInverse: '#08090C',

  // Border
  border: '#1F2430',
  borderLight: '#2A3040',
  divider: '#1F2430',

  // Misc
  shadow: 'rgba(0, 0, 0, 0.5)',
  overlay: 'rgba(0, 0, 0, 0.6)',
  transparent: 'transparent',

  // Map specific
  map: {
    user: '#3BA9FF',
    bus: '#8A73FF',
    stop: '#FFA23C',
    nearestStop: '#FF5470',
  },
};

export type ThemeColors = typeof lightColors;
