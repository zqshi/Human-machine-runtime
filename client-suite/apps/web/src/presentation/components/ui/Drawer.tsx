import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  width?: string;
  children: ReactNode;
}

export function Drawer({ open, onClose, title, width = 'w-[420px]', children }: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div
        className={`fixed right-0 top-0 bottom-0 ${width} bg-white border-l border-gray-200 shadow-xl z-50 flex flex-col`}
      >
        <div className="flex flex-col flex-1 min-h-0 p-6">
          {title && (
            <div className="flex items-center justify-between mb-6 shrink-0">
              <h2 className="text-base font-semibold text-gray-900">{title}</h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <Icon name="close" size={20} />
              </button>
            </div>
          )}
          <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
        </div>
      </div>
    </>,
    document.body
  );
}
