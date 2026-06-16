import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

let useToastStore: (typeof import('../toastStore'))['useToastStore'];

beforeEach(async () => {
  vi.useFakeTimers();
  vi.resetModules();
  const mod = await import('../toastStore');
  useToastStore = mod.useToastStore;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('toastStore', () => {
  it('starts with empty toasts', () => {
    expect(useToastStore.getState().toasts).toEqual([]);
  });

  it('addToast appends a toast', () => {
    useToastStore.getState().addToast('hello', 'success');
    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0].message).toBe('hello');
    expect(toasts[0].type).toBe('success');
    expect(toasts[0].id).toMatch(/^toast-/);
  });

  it('addToast auto-removes after 3s', () => {
    useToastStore.getState().addToast('temp', 'info');
    expect(useToastStore.getState().toasts).toHaveLength(1);
    vi.advanceTimersByTime(3000);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('removeToast removes specific toast', () => {
    useToastStore.getState().addToast('a', 'success');
    useToastStore.getState().addToast('b', 'error');
    const id = useToastStore.getState().toasts[0].id;
    useToastStore.getState().removeToast(id);
    expect(useToastStore.getState().toasts).toHaveLength(1);
    expect(useToastStore.getState().toasts[0].message).toBe('b');
  });

  it('multiple toasts accumulate', () => {
    useToastStore.getState().addToast('a', 'success');
    useToastStore.getState().addToast('b', 'error');
    useToastStore.getState().addToast('c', 'info');
    expect(useToastStore.getState().toasts).toHaveLength(3);
  });
});
