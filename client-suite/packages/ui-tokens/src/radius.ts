/**
 * DCF Design Tokens — Border Radius
 * Aligned with stitch tailwind.config
 */

export const radius = {
  DEFAULT: '0.5rem',   // 8px
  lg: '1rem',          // 16px — aligned with stitch
  xl: '1.25rem',       // 20px — aligned with stitch
  '2xl': '1.25rem',    // 20px (stitch) — note: im-platform uses 24px
  '3xl': '1.5rem',     // 24px
  full: '9999px',
} as const;
