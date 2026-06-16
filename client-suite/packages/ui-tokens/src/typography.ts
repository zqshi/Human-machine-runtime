/**
 * DCF Design Tokens — Typography
 * Font: Inter + PingFang SC (CJK fallback)
 */

export const typography = {
  fontFamily: {
    sans: ['Inter', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'sans-serif'],
    display: ['Inter', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'sans-serif'],
    mono: ['SF Mono', 'Menlo', 'Consolas', 'monospace'],
  },

  fontSize: {
    '2xs': ['10px', { lineHeight: '14px' }],
    xs: ['11px', { lineHeight: '16px' }],
    sm: ['12px', { lineHeight: '16px' }],
    base: ['13px', { lineHeight: '20px' }],
    md: ['14px', { lineHeight: '20px' }],
    lg: ['16px', { lineHeight: '24px' }],
    xl: ['18px', { lineHeight: '28px' }],
    '2xl': ['24px', { lineHeight: '32px' }],
    '3xl': ['30px', { lineHeight: '36px' }],
  },

  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
} as const;
