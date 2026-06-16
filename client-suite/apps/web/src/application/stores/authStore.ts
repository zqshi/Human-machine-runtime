import { create } from 'zustand';
import type { UserProfile } from '../../infrastructure/matrix/MatrixClientAdapter';
import type { AuthUser, AuthProviderInfo } from '../../infrastructure/api/dcfApiClient';
import { LocalStorageAdapter } from '../../infrastructure/storage/LocalStorageAdapter';

const AUTH_KEY = 'dcf_auth';
const SSO_STATE_KEY = 'dcf_sso_state';

interface PersistedAuth {
  homeserverUrl: string;
  accessToken: string;
  userId: string;
  deviceId?: string;
}

export type ChannelMode = 'matrix' | 'wps';
export type AuthMethod = 'local' | 'sso';

interface AuthState {
  user: UserProfile | null;
  dcfUser: AuthUser | null;
  accessToken: string | null;
  homeserverUrl: string | null;
  deviceId: string | null;
  isLoggedIn: boolean;
  /** Current messaging channel backend */
  channelMode: ChannelMode;
  /** True when authenticated against DCF backend (cookie session active) */
  isBackendConnected: boolean;
  /** How this user authenticated */
  authMethod: AuthMethod;
  /** Available auth providers from backend */
  ssoProviders: AuthProviderInfo[];

  setAuth(user: UserProfile, token: string, homeserver: string, deviceId?: string): void;
  setDcfUser(dcfUser: AuthUser): void;
  setChannelMode(mode: ChannelMode): void;
  setAuthMethod(method: AuthMethod): void;
  setSsoProviders(providers: AuthProviderInfo[]): void;
  loginDcfOnly(dcfUser: AuthUser): void;
  saveSsoState(state: string): void;
  getSsoState(): string | null;
  clearSsoState(): void;
  clearAuth(): void;
  persistAuth(): void;
  loadPersistedAuth(): PersistedAuth | null;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  dcfUser: null,
  accessToken: null,
  homeserverUrl: null,
  deviceId: null,
  isLoggedIn: false,
  channelMode: 'matrix',
  isBackendConnected: false,
  authMethod: 'local',
  ssoProviders: [],

  setAuth(user, token, homeserver, deviceId) {
    set({
      user,
      accessToken: token,
      homeserverUrl: homeserver,
      deviceId: deviceId ?? null,
      isLoggedIn: true,
    });
  },

  setDcfUser(dcfUser) {
    set({ dcfUser, isBackendConnected: true });
  },

  loginDcfOnly(dcfUser) {
    const fakeProfile: UserProfile = {
      userId: dcfUser.username,
      displayName: dcfUser.username,
      avatarUrl: null,
    };
    set({
      user: fakeProfile,
      dcfUser,
      accessToken: 'dcf-session',
      homeserverUrl: window.location.origin,
      isLoggedIn: true,
      isBackendConnected: true,
      channelMode: 'matrix',
      authMethod: 'local',
    });
    LocalStorageAdapter.set(AUTH_KEY, {
      homeserverUrl: window.location.origin,
      accessToken: 'dcf-session',
      userId: dcfUser.username,
    });
  },

  setChannelMode(mode) {
    set({ channelMode: mode });
  },

  setAuthMethod(method) {
    set({ authMethod: method });
  },

  setSsoProviders(providers) {
    set({ ssoProviders: providers });
  },

  saveSsoState(state: string) {
    LocalStorageAdapter.set(SSO_STATE_KEY, state);
  },

  getSsoState() {
    return LocalStorageAdapter.get<string | null>(SSO_STATE_KEY, null);
  },

  clearSsoState() {
    LocalStorageAdapter.remove(SSO_STATE_KEY);
  },

  clearAuth() {
    set({
      user: null,
      dcfUser: null,
      accessToken: null,
      homeserverUrl: null,
      deviceId: null,
      isLoggedIn: false,
      channelMode: 'matrix',
      isBackendConnected: false,
      authMethod: 'local',
      ssoProviders: [],
    });
    LocalStorageAdapter.remove(AUTH_KEY);
  },

  persistAuth() {
    const { user, accessToken, homeserverUrl, deviceId } = get();
    if (user && accessToken && homeserverUrl) {
      LocalStorageAdapter.set(AUTH_KEY, {
        homeserverUrl,
        accessToken,
        userId: user.userId,
        deviceId: deviceId ?? undefined,
      });
    }
  },

  loadPersistedAuth() {
    return LocalStorageAdapter.get<PersistedAuth | null>(AUTH_KEY, null);
  },
}));
