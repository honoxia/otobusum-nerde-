// Spacing sabitleri (4'ün katları)
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

// Border radius
export const borderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
} as const;

// Icon sizes
export const iconSize = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
} as const;

// Component heights
export const componentHeight = {
  button: 48,
  input: 48,
  chip: 32,
  statusBar: 24,
} as const;

export type Spacing = typeof spacing;
export type BorderRadius = typeof borderRadius;
