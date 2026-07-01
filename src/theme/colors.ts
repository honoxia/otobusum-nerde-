// Light/Dark renk paletleri — Stitch "Eskişehir Ulaşım" tasarımı (Material 3, indigo/lavanta)

export const lightColors = {
  // Primary (indigo aksiyon / lavanta vurgu)
  primary: '#4F46E5',
  primaryLight: '#6B63F0',
  primaryDark: '#3323CC',

  // Semantic
  success: '#1E9E6A',
  warning: '#B5561E',
  error: '#B3261E',
  info: '#4F46E5',

  // Background
  background: '#F6F7FC',
  surface: '#FFFFFF',
  surfaceSecondary: '#ECEEF7',

  // Text
  textPrimary: '#111629',
  textSecondary: '#464659',
  textTertiary: '#918FA1',
  textInverse: '#FFFFFF',

  // Border
  border: '#D9DBE6',
  borderLight: '#E7E9F2',
  divider: '#D9DBE6',

  // Misc
  shadow: 'rgba(17, 22, 41, 0.08)',
  overlay: 'rgba(11, 19, 38, 0.35)',
  transparent: 'transparent',

  // Map specific
  map: {
    user: '#3BA9FF',
    bus: '#4F46E5',
    stop: '#B5561E',
    nearestStop: '#B3261E',
  },
};

export const darkColors = {
  // Primary — indigo (aksiyon/dolu buton) + lavanta (koyu üzeri vurgu, ikon/başlık)
  primary: '#4F46E5',
  primaryLight: '#C3C0FF',
  primaryDark: '#3323CC',

  // Semantic
  success: '#2FD08A',
  warning: '#FFB695',
  error: '#FFB4AB',
  info: '#C3C0FF',

  // Background (koyu lacivert)
  background: '#0B1326',
  surface: '#171F33', // surface-container
  surfaceSecondary: '#222A3D', // surface-container-high (kart)

  // Text
  textPrimary: '#DAE2FD',
  textSecondary: '#C7C4D8',
  textTertiary: '#918FA1',
  textInverse: '#FFFFFF',

  // Border
  border: '#464555', // outline-variant
  borderLight: '#2D3449', // surface-variant
  divider: '#2D3449',

  // Misc
  shadow: 'rgba(0, 0, 0, 0.5)',
  overlay: 'rgba(0, 0, 0, 0.6)',
  transparent: 'transparent',

  // Map specific
  map: {
    user: '#3BA9FF',
    bus: '#4F46E5',
    stop: '#FFB695',
    nearestStop: '#FFB4AB',
  },
};

export type ThemeColors = typeof lightColors;
