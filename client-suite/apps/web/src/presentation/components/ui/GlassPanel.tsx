import type { ReactNode } from 'react';

interface GlassPanelProps {
  children: ReactNode;
  className?: string;
}

export function GlassPanel({ children, className = '' }: GlassPanelProps) {
  return (
    <div
      className={`backdrop-blur-[20px] ${className}`}
      style={{ backgroundColor: 'var(--glass-sidebar-bg)' }}
    >
      {children}
    </div>
  );
}
