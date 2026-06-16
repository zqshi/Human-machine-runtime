import type { ReactNode } from 'react';
import { Icon } from './Icon';

interface EmptyStateProps {
  icon: string;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="text-center py-16">
      <Icon name={icon} size={48} className="text-text-muted/30 mx-auto mb-3" />
      <p className="text-sm font-medium text-text-muted">{title}</p>
      {description && (
        <p className="text-xs text-text-muted/70 mt-1">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
