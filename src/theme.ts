import { Platform, TextStyle, ViewStyle } from 'react-native';

/**
 * "Bold Gamified" design tokens.
 *
 * Shared palette, radii, and shadow presets that give every screen the same
 * playful, rounded, blue-forward look from the redesign mockups. Screens import
 * these instead of hard-coding hex values so the theme stays consistent.
 */
export const colors = {
  // Surfaces
  appBg: '#eef4fa',
  surface: '#ffffff',
  mutedBg: '#eef4fa',
  inputBg: '#ffffff',

  // Borders
  border: '#e3ecf5',
  borderStrong: '#cfe0f0',

  // Brand blue
  primary: '#2f9bf0',
  primaryDark: '#2585e0',

  // Text
  navy: '#16314f',
  body: '#415870',
  textMuted: '#5e788f',
  textSubtle: '#7b91a8',
  textFaint: '#9fb0c2',

  // Accent chips
  chipBlueBg: '#eaf5ff',
  chipBlueText: '#2585e0',

  green: '#1bb673',
  greenSoftBg: '#e4f7ef',
  greenText: '#0f7a4f',

  amber: '#f6a124',
  amberSoftBg: '#fff3e3',
  amberText: '#b06f12',

  dangerBg: '#fff1f2',
  dangerBorder: '#fbd5da',
  dangerText: '#e0556b',

  white: '#ffffff',
  onPrimary: '#ffffff',
} as const;

export const radius = {
  sm: 12,
  md: 14,
  lg: 18,
  xl: 22,
  pill: 999,
} as const;

// Soft, lifted card shadow. Cross-platform: iOS shadow* props + Android elevation.
export const shadows: Record<'card' | 'soft' | 'primary' | 'fab', ViewStyle> = {
  card: {
    shadowColor: '#16314f',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 3,
  },
  soft: {
    shadowColor: '#16314f',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  primary: {
    shadowColor: '#2585e0',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.38,
    shadowRadius: 16,
    elevation: 4,
  },
  fab: {
    shadowColor: '#f6a124',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 6,
  },
};

// Heavy display weights drive the gamified feel. Platform note: RN web maps
// '900' fine; native falls back gracefully on system fonts.
export const text = {
  eyebrow: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  } as TextStyle,
  title: {
    color: colors.navy,
    fontSize: 34,
    fontWeight: '900',
  } as TextStyle,
};

export const USE_NATIVE_DRIVER = Platform.OS !== 'web';
