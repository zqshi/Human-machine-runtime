import type { ReactNode } from 'react';

interface SectionLabelProps {
  children: ReactNode;
}

export function SectionLabel({ children }: SectionLabelProps) {
  return (
    <h3 className="text-[11px] font-bold uppercase tracking-wider text-text-muted px-2 mb-1.5">
      {children}
    </h3>
  );
}
