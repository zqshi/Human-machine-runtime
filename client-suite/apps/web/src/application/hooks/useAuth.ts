import { useAuthStore } from '../stores/authStore';

export function useAuth() {
  const { user, dcfUser, isLoggedIn, isBackendConnected } = useAuthStore();
  return { user, dcfUser, isLoggedIn, isBackendConnected };
}
