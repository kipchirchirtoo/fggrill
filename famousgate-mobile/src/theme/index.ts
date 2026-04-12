import { MD3LightTheme as DefaultTheme } from 'react-native-paper';
import { colors } from './colors';

export * from './colors';
export { textStyles } from './typography';

export const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary.DEFAULT,
    primaryContainer: colors.primary.light,
    secondary: colors.warm[700],
    secondaryContainer: colors.warm[100],
    tertiary: colors.accent.DEFAULT,
    tertiaryContainer: colors.accent.light,
    surface: colors.card,
    surfaceVariant: colors.input,
    background: colors.background,
    error: colors.danger.DEFAULT,
    errorContainer: colors.danger.light,
    onPrimary: colors.primary.foreground,
    onPrimaryContainer: colors.primary.dark,
    onSecondary: colors.warm[50],
    onSecondaryContainer: colors.warm[900],
    onTertiary: colors.accent.foreground,
    onTertiaryContainer: colors.accent.dark,
    onSurface: colors.text.primary,
    onSurfaceVariant: colors.text.secondary,
    onError: colors.danger.foreground,
    onErrorContainer: colors.danger.dark,
    onBackground: colors.text.primary,
    outline: colors.border,
    outlineVariant: colors.border,
    inverseSurface: colors.primary.dark,
    inverseOnSurface: colors.primary.foreground,
    inversePrimary: colors.primary.light,
    shadow: colors.text.primary,
    scrim: colors.text.primary,
    backdrop: 'rgba(0, 0, 0, 0.4)',
    elevation: {
      level0: 'transparent',
      level1: colors.card,
      level2: colors.card,
      level3: colors.card,
      level4: colors.card,
      level5: colors.card,
    },
  },
  roundness: 12,
};
