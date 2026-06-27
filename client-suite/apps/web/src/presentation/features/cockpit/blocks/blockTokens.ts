export const blockTokens = {
  card: 'rounded-xl border border-[var(--block-border)] bg-[var(--block-bg)]',
  cardHover: 'hover:bg-[var(--block-bg-hover)]',
  cardInteractive:
    'rounded-xl border border-[var(--block-border)] bg-[var(--block-bg)] hover:bg-[var(--block-bg-hover)] transition-colors cursor-pointer',
  text: 'text-[var(--block-text)]',
  textMuted: 'text-[var(--block-text-muted)]',
  textHeading: 'text-[var(--block-text-heading)]',
  progress: 'bg-[var(--block-progress)]',
  progressTrack: 'bg-[var(--block-progress-track)]',
  divider: 'border-[var(--block-border)]',
} as const;

export type BlockTokenKey = keyof typeof blockTokens;

export function mergeStyleHints(
  baseClass: string,
  styleHints?: Record<string, string>
): { className: string; style?: React.CSSProperties } {
  if (!styleHints || Object.keys(styleHints).length === 0) {
    return { className: baseClass };
  }
  return { className: baseClass, style: styleHints as React.CSSProperties };
}
