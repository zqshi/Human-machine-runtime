/**
 * DCF Design Tokens — Spacing & Layout
 */

export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  '2xl': '32px',
  '3xl': '48px',
} as const;

export const layout = {
  dock: '80px',
  sidebar: '320px',
  drawer: 'clamp(360px, 55%, 900px)',
  drawerMin: '360px',
  drawerMax: '900px',
  sidebarMin: '260px',
  sidebarMax: '400px',
  gap: {
    section: '24px',
    card: '12px',
    item: '8px',
  },
} as const;
