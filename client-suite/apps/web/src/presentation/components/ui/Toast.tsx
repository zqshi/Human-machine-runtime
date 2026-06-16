import { useToastStore, type ToastType } from '../../../application/stores/toastStore';

const borderClass: Record<ToastType, string> = {
  success: 'border-l-success',
  error: 'border-l-error',
  info: 'border-l-primary',
};

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto bg-bg-white-var rounded-xl shadow-card px-4 py-3 border-l-4 ${borderClass[t.type]} min-w-[240px] max-w-[360px] text-sm text-text-primary cursor-pointer animate-[toast-in_0.25s_ease-out]`}
          onClick={() => removeToast(t.id)}
        >
          {t.message}
        </div>
      ))}
      <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateX(40px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
