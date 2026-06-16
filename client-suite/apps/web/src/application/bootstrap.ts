/**
 * Application bootstrap — 在渲染前注入 infrastructure 层回调。
 * 调用一次即可，幂等。
 */
import { useAuthStore } from './stores/authStore';
import { setOnSessionExpired } from '../infrastructure/api/sessionHandler';

let initialized = false;

export function bootstrapApp(): void {
  if (initialized) return;
  initialized = true;

  setOnSessionExpired(() => {
    useAuthStore.getState().clearAuth();
  });
}
