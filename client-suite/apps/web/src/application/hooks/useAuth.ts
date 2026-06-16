import { useAuthStore } from '../stores/authStore';

export function useAuth() {
  const { user, hmrUser, isLoggedIn, isBackendConnected } = useAuthStore();
  return { user, hmrUser, isLoggedIn, isBackendConnected };
}
