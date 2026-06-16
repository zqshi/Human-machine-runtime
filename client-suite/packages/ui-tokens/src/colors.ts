/**
 * DCF Design Tokens — Colors
 * Mode-switchable colors use CSS custom properties (RGB channels).
 * Tailwind <alpha-value> pattern: rgb(var(--c-xxx) / <alpha-value>)
 */

/** Helper — produces `rgb(var(--name) / <alpha-value>)` for Tailwind */
const cv = (name: string) => `rgb(var(${name}) / <alpha-value>)`;

export const colors = {
  primary: {
    DEFAULT: cv('--c-primary'),
    light: cv('--c-primary-light'),
    dark: cv('--c-primary-dark'),
    50: 'rgb(var(--c-primary) / 0.06)',
    100: 'rgb(var(--c-primary) / 0.10)',
  },

  semantic: {
    secondary: cv('--c-secondary'),
    success: cv('--c-success'),
    warning: cv('--c-warning'),
    error: cv('--c-error'),
  },

  background: {
    light: 'var(--bg-light)',
    white: 'var(--bg-white)',
    hover: 'var(--bg-hover)',
    active: 'var(--bg-active)',
    panel: 'var(--panel-bg)',
    card: 'var(--bg-card)',
  },

  text: {
    primary: cv('--c-text-primary'),
    secondary: cv('--c-text-secondary'),
    muted: cv('--c-text-muted'),
    heading: cv('--c-text-primary'),
  },

  border: {
    DEFAULT: 'var(--border-color)',
    light: 'var(--border-light)',
    panel: 'var(--border-light)',
    card: 'var(--border-card)',
    cardHover: 'var(--border-card)',
  },

  agent: {
    online: '#34C759',
    busy: '#FF9500',
    offline: '#AEAEB2',
  },

  apple: {
    gray: '#8E8E93',
  },
} as const;
