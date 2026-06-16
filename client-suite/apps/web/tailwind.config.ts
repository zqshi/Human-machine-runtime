import type { Config } from 'tailwindcss';
import { tailwindPreset } from '@dcf/ui-tokens';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  presets: [tailwindPreset as unknown as Partial<Config>],
  theme: {
    extend: {
      colors: {
        purple: 'rgb(var(--c-purple) / <alpha-value>)',
        'surface-dark': 'var(--color-surface-dark)',
        'fill-tertiary': 'var(--color-fill-tertiary)',
      },
    },
  },
  plugins: [],
} satisfies Config;
