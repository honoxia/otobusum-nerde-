import React, { createContext, useMemo, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { lightColors, darkColors, ThemeColors } from './colors';
import { spacing, borderRadius, iconSize, componentHeight, Spacing, BorderRadius } from './spacing';
import { fontSize, fontWeight, textStyles, FontSize, TextStyles } from './typography';

export interface Theme {
  colors: ThemeColors;
  spacing: Spacing;
  borderRadius: BorderRadius;
  iconSize: typeof iconSize;
  componentHeight: typeof componentHeight;
  fontSize: FontSize;
  fontWeight: typeof fontWeight;
  textStyles: TextStyles;
  isDark: boolean;
}

export const ThemeContext = createContext<Theme | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
  forcedTheme?: 'light' | 'dark';
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children, forcedTheme }) => {
  const systemColorScheme = useColorScheme();
  const isDark = forcedTheme ? forcedTheme === 'dark' : systemColorScheme === 'dark';

  const theme = useMemo<Theme>(
    () => ({
      colors: isDark ? darkColors : lightColors,
      spacing,
      borderRadius,
      iconSize,
      componentHeight,
      fontSize,
      fontWeight,
      textStyles,
      isDark,
    }),
    [isDark]
  );

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
};
