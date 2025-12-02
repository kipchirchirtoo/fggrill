/**
 * iOS/Apple Design System Tokens
 * Minimal, clean, and consistent design language
 */

export const iosColors = {
  // Background
  background: '#FFFFFF',
  backgroundSecondary: '#F2F2F7',
  backgroundTertiary: '#E5E5EA',
  backgroundElevated: '#FFFFFF',
  
  // Text
  textPrimary: '#000000',
  textSecondary: '#3C3C43',
  textTertiary: '#8E8E93',
  textQuaternary: '#C7C7CC',
  
  // System Colors
  blue: '#007AFF',
  green: '#34C759',
  indigo: '#5856D6',
  orange: '#FF9500',
  pink: '#FF2D55',
  purple: '#AF52DE',
  red: '#FF3B30',
  teal: '#5AC8FA',
  yellow: '#FFCC00',
  
  // Gray Scale
  gray: '#8E8E93',
  gray2: '#AEAEB2',
  gray3: '#C7C7CC',
  gray4: '#D1D1D6',
  gray5: '#E5E5EA',
  gray6: '#F2F2F7',
  
  // Separators
  separator: 'rgba(60, 60, 67, 0.29)',
  separatorLight: 'rgba(60, 60, 67, 0.12)',
  separatorOpaque: '#C6C6C8',
  
  // Fills
  fillPrimary: 'rgba(120, 120, 128, 0.2)',
  fillSecondary: 'rgba(120, 120, 128, 0.16)',
  fillTertiary: 'rgba(118, 118, 128, 0.12)',
  fillQuaternary: 'rgba(116, 116, 128, 0.08)',
} as const;

export const iosSpacing = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  '2xl': '40px',
  '3xl': '48px',
} as const;

export const iosBorderRadius = {
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '20px',
  '2xl': '24px',
  full: '9999px',
} as const;

export const iosShadows = {
  sm: '0 1px 3px rgba(0, 0, 0, 0.08)',
  md: '0 4px 12px rgba(0, 0, 0, 0.08)',
  lg: '0 8px 24px rgba(0, 0, 0, 0.12)',
  xl: '0 16px 32px rgba(0, 0, 0, 0.16)',
} as const;

export const iosTypography = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Segoe UI", Roboto, sans-serif',
  
  sizes: {
    xs: '12px',
    sm: '14px',
    base: '16px',
    lg: '18px',
    xl: '20px',
    '2xl': '24px',
    '3xl': '28px',
    '4xl': '32px',
    '5xl': '40px',
  },
  
  weights: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  
  lineHeights: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
} as const;

export const iosTransitions = {
  fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
  normal: '250ms cubic-bezier(0.4, 0, 0.2, 1)',
  slow: '350ms cubic-bezier(0.4, 0, 0.2, 1)',
} as const;

// Status color mappings
export const statusColors = {
  success: iosColors.green,
  warning: iosColors.orange,
  error: iosColors.red,
  info: iosColors.blue,
  pending: iosColors.yellow,
} as const;

// Component-specific tokens
export const componentTokens = {
  button: {
    height: {
      sm: '32px',
      md: '44px',
      lg: '52px',
    },
    padding: {
      sm: '0 12px',
      md: '0 16px',
      lg: '0 24px',
    },
  },
  
  card: {
    padding: {
      sm: '12px',
      md: '16px',
      lg: '24px',
    },
    borderRadius: iosBorderRadius.lg,
    shadow: iosShadows.sm,
  },
  
  input: {
    height: '44px',
    padding: '0 16px',
    borderRadius: iosBorderRadius.md,
  },
  
  badge: {
    padding: '4px 12px',
    borderRadius: iosBorderRadius.full,
    fontSize: iosTypography.sizes.xs,
  },
} as const;

export default {
  colors: iosColors,
  spacing: iosSpacing,
  borderRadius: iosBorderRadius,
  shadows: iosShadows,
  typography: iosTypography,
  transitions: iosTransitions,
  statusColors,
  componentTokens,
};
