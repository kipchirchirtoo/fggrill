/**
 * FamousGate Hotels Brand Colors
 * Extracted from frontend design system
 */

export const colors = {
  // Primary Brand Colors
  primary: {
    DEFAULT: '#2E2C28', // Rich charcoal
    light: '#45423C',
    dark: '#1A1917',
    foreground: '#FAFAF8',
  },

  // Secondary/Warm Palette
  warm: {
    50: '#FAFAF8',
    100: '#F5F4F1',
    200: '#E8E6E1',
    300: '#D4D1C9',
    400: '#A8A49A',
    500: '#78746B',
    600: '#5C5850',
    700: '#45423C',
    800: '#2E2C28',
    900: '#1A1917',
  },

  // Accent - Warm Amber Gold
  accent: {
    DEFAULT: '#F59E0B', // Amber 500
    light: '#FCD34D',
    dark: '#D97706',
    foreground: '#1A1917',
  },

  // Status Colors
  success: {
    DEFAULT: '#10B981', // Emerald 500
    light: '#34D399',
    dark: '#059669',
    foreground: '#FFFFFF',
  },

  warning: {
    DEFAULT: '#F59E0B', // Amber 500
    light: '#FCD34D',
    dark: '#D97706',
    foreground: '#1A1917',
  },

  danger: {
    DEFAULT: '#EF4444', // Red 500
    light: '#F87171',
    dark: '#DC2626',
    foreground: '#FFFFFF',
  },

  info: {
    DEFAULT: '#3B82F6', // Blue 500
    light: '#60A5FA',
    dark: '#2563EB',
    foreground: '#FFFFFF',
  },

  // UI Elements
  background: '#FAFAF8',
  foreground: '#1A1917',
  card: '#FFFFFF',
  cardForeground: '#1A1917',
  border: '#E8E6E1',
  input: '#F5F4F1',
  muted: '#F5F4F1',
  mutedForeground: '#78746B',

  // Text Colors
  text: {
    primary: '#1A1917',
    secondary: '#45423C',
    tertiary: '#78746B',
    disabled: '#A8A49A',
    inverse: '#FFFFFF',
  },

  // iOS-style colors (for consistency with frontend)
  ios: {
    systemGray: '#8E8E93',
    systemGray2: '#AEAEB2',
    systemGray3: '#C7C7CC',
    systemGray4: '#D1D1D6',
    systemGray5: '#E5E5EA',
    systemGray6: '#F2F2F7',
    label: '#000000',
    secondaryLabel: '#3C3C43',
    tertiaryLabel: '#3C3C4399',
    separator: '#3C3C4349',
  },
};

export const shadows = {
  sm: {
    shadowColor: '#1A1917',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#1A1917',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 4,
  },
  lg: {
    shadowColor: '#1A1917',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 8,
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const borderRadius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 9999,
};

export const typography = {
  fontFamily: {
    regular: 'System',
    medium: 'System',
    semibold: 'System',
    bold: 'System',
  },
  fontSize: {
    xs: 11,
    sm: 13,
    base: 15,
    lg: 17,
    xl: 20,
    '2xl': 24,
    '3xl': 28,
    '4xl': 32,
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
};
