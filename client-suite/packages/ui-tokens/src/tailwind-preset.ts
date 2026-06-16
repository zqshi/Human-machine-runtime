/**
 * DCF Tailwind Preset
 * Usage: presets: [require('@dcf/ui-tokens/tailwind-preset')]
 *    or: import dcfPreset from '@dcf/ui-tokens/tailwind-preset'
 */

import { colors } from './colors';
import { shadows } from './shadows';
import { typography } from './typography';
import { radius } from './radius';

const dcfPreset = {
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: colors.primary.DEFAULT,
          light: colors.primary.light,
          dark: colors.primary.dark,
          50: colors.primary[50],
          100: colors.primary[100],
        },
        secondary: colors.semantic.secondary,
        success: colors.semantic.success,
        warning: colors.semantic.warning,
        error: colors.semantic.error,
        'bg-light': colors.background.light,
        'bg-white-var': colors.background.white,
        'bg-panel': colors.background.panel,
        'bg-card': colors.background.card,
        'bg-hover': colors.background.hover,
        'bg-active': colors.background.active,
        'glass-sidebar': 'var(--glass-sidebar-bg)',
        'glass-popover': 'var(--glass-popover-bg)',
        'text-primary': colors.text.primary,
        'text-secondary': colors.text.secondary,
        'text-muted': colors.text.muted,
        border: colors.border.DEFAULT,
        'border-light': colors.border.light,
        'border-card': colors.border.card,
        'apple-gray': colors.apple.gray,
        agent: colors.agent,
      },
      fontFamily: {
        sans: typography.fontFamily.sans,
        display: typography.fontFamily.display,
        mono: typography.fontFamily.mono,
      },
      fontSize: typography.fontSize,
      borderRadius: {
        DEFAULT: radius.DEFAULT,
        lg: radius.lg,
        xl: radius.xl,
        '2xl': radius['2xl'],
        '3xl': radius['3xl'],
        full: radius.full,
      },
      boxShadow: {
        sm: shadows.sm,
        md: shadows.md,
        lg: shadows.lg,
        macos: shadows.macos,
        card: shadows.card,
        'card-hover': shadows.cardHover,
        drawer: shadows.drawer,
        'btn-primary': shadows.btnPrimary,
        focus: shadows.focus,
      },
    },
  },
} as const;

export default dcfPreset;
