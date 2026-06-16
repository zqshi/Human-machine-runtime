import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const storage = new Map<string, string>();
const localStorageMock = {
  getItem: vi.fn((key: string) => storage.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => storage.set(key, value)),
  removeItem: vi.fn((key: string) => storage.delete(key)),
  clear: vi.fn(() => storage.clear()),
  get length() {
    return storage.size;
  },
  key: vi.fn(() => null),
} satisfies Storage;

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

let useAuthStore: (typeof import('../authStore'))['useAuthStore'];

const demoUser = {
  userId: '@demo:local',
  displayName: 'Demo',
  avatarUrl: null,
  avatarMxc: null,
};

beforeEach(async () => {
  storage.clear();
  vi.clearAllMocks();
  vi.resetModules();
  const mod = await import('../authStore');
  useAuthStore = mod.useAuthStore;
});

describe('authStore', () => {
  it('starts logged out', () => {
    const s = useAuthStore.getState();
    expect(s.isLoggedIn).toBe(false);
    expect(s.user).toBeNull();
    expect(s.channelMode).toBe('matrix');
  });

  it('setAuth logs in', () => {
    useAuthStore.getState().setAuth(demoUser, 'tok', 'https://hs', 'dev1');
    const s = useAuthStore.getState();
    expect(s.isLoggedIn).toBe(true);
    expect(s.user?.userId).toBe('@demo:local');
    expect(s.accessToken).toBe('tok');
    expect(s.deviceId).toBe('dev1');
  });

  it('setDcfUser marks backend connected', () => {
    useAuthStore.getState().setDcfUser({ id: 'u1', username: 'admin' } as never);
    expect(useAuthStore.getState().isBackendConnected).toBe(true);
  });

  it('clearAuth resets everything', () => {
    useAuthStore.getState().setAuth(demoUser, 'tok', 'https://hs');
    useAuthStore.getState().clearAuth();
    const s = useAuthStore.getState();
    expect(s.isLoggedIn).toBe(false);
    expect(s.user).toBeNull();
    expect(s.accessToken).toBeNull();
    expect(s.isBackendConnected).toBe(false);
    expect(s.channelMode).toBe('matrix');
  });

  it('persistAuth and loadPersistedAuth round-trip', () => {
    useAuthStore.getState().setAuth(demoUser, 'tok-123', 'https://hs.io');
    useAuthStore.getState().persistAuth();
    const loaded = useAuthStore.getState().loadPersistedAuth();
    expect(loaded?.accessToken).toBe('tok-123');
    expect(loaded?.userId).toBe('@demo:local');
    expect(loaded?.homeserverUrl).toBe('https://hs.io');
  });

  it('loadPersistedAuth returns null when empty', () => {
    expect(useAuthStore.getState().loadPersistedAuth()).toBeNull();
  });

  it('clearAuth removes persisted auth', () => {
    useAuthStore.getState().setAuth(demoUser, 'tok', 'https://hs');
    useAuthStore.getState().persistAuth();
    useAuthStore.getState().clearAuth();
    expect(useAuthStore.getState().loadPersistedAuth()).toBeNull();
  });

  it('setChannelMode updates mode', () => {
    useAuthStore.getState().setChannelMode('matrix');
    expect(useAuthStore.getState().channelMode).toBe('matrix');
  });

  it('setAuthMethod updates method', () => {
    useAuthStore.getState().setAuthMethod('sso');
    expect(useAuthStore.getState().authMethod).toBe('sso');
  });

  it('setSsoProviders stores provider list', () => {
    const providers = [{ type: 'oidc', name: 'Keycloak', url: 'https://kc' }] as never[];
    useAuthStore.getState().setSsoProviders(providers);
    expect(useAuthStore.getState().ssoProviders).toHaveLength(1);
  });

  it('sso state save/get/clear round-trip', () => {
    useAuthStore.getState().saveSsoState('state-xyz');
    expect(useAuthStore.getState().getSsoState()).toBe('state-xyz');
    useAuthStore.getState().clearSsoState();
    expect(useAuthStore.getState().getSsoState()).toBeNull();
  });
});
