import { describe, it, expect } from 'vitest';
import { AuthService, ROLE_PERMISSIONS } from './auth-service.js';
import { AuthProviderRegistry } from './auth-provider-registry.js';
import { LocalAuthProvider } from './providers/local-provider.js';
import type { LocalUserRecord } from './providers/local-provider.js';

const SEED_USERS = [
  { username: 'admin', password: 'plain:admin123', role: 'platform_admin' },
  {
    username: 'ops',
    password: 'plain:ops123',
    role: 'ops_admin',
    scope: 'tenant',
    tenantId: 'tn_1',
  },
  { username: 'disabled', password: 'plain:x', role: 'tenant_ops', disabled: true },
];

function makeService(users = SEED_USERS) {
  const userMap = new Map(users.map((u) => [u.username, u]));
  const store = {
    findByUsername: async (name: string): Promise<LocalUserRecord | null> => {
      const u = userMap.get(name);
      if (!u) return null;
      return { username: u.username, passwordHash: u.password, disabled: u.disabled };
    },
  };
  const registry = new AuthProviderRegistry('local');
  registry.register(new LocalAuthProvider(store, { allowPlainPassword: true }));
  return new AuthService(users, undefined, registry);
}

describe('AuthService', () => {
  describe('resolvePermissions', () => {
    it('returns platform:* for platform_admin', () => {
      const svc = makeService();
      const perms = svc.resolvePermissions('platform_admin');
      expect(perms).toContain('platform:*');
    });

    it('returns tenant permissions for tenant_admin', () => {
      const svc = makeService();
      const perms = svc.resolvePermissions('tenant_admin');
      expect(perms).toContain('tenant:instance:read');
      expect(perms).toContain('tenant:instance:write');
    });

    it('maps legacy ops_admin to tenant_ops permissions', () => {
      const svc = makeService();
      const perms = svc.resolvePermissions('ops_admin');
      expect(perms).toEqual(ROLE_PERMISSIONS['ops_admin']);
    });

    it('returns empty for unknown role', () => {
      const svc = makeService();
      expect(svc.resolvePermissions('nonexistent')).toEqual([]);
    });
  });

  describe('login', () => {
    it('returns token and principal for valid credentials', async () => {
      const svc = makeService();
      const result = await svc.login('admin', 'admin123');
      expect(result.token).toBeTruthy();
      expect(result.tokenType).toBe('Bearer');
      expect(result.user.username).toBe('admin');
      expect(result.user.scope).toBe('platform');
      expect(result.user.role).toBe('platform_admin');
      expect(result.user.permissions).toContain('platform:*');
    });

    it('throws for wrong password', async () => {
      const svc = makeService();
      await expect(svc.login('admin', 'wrong')).rejects.toThrow();
    });

    it('throws for unknown user', async () => {
      const svc = makeService();
      await expect(svc.login('nobody', 'x')).rejects.toThrow();
    });

    it('throws for disabled user', async () => {
      const svc = makeService();
      await expect(svc.login('disabled', 'x')).rejects.toThrow();
    });

    it('throws when scope mismatch', async () => {
      const svc = makeService();
      await expect(svc.login('admin', 'admin123', { requiredScope: 'tenant' })).rejects.toThrow(
        'invalid credentials for this console'
      );
    });

    it('assigns tenantId for tenant-scoped users', async () => {
      const svc = makeService();
      const result = await svc.login('ops', 'ops123');
      expect(result.user.scope).toBe('tenant');
      expect(result.user.tenantId).toBe('tn_1');
    });

    it('uses default tenantId when none specified', async () => {
      const users = [{ username: 't1', password: 'plain:pw', role: 'tenant_admin' }];
      const svc = makeService(users);
      const result = await svc.login('t1', 'pw');
      expect(result.user.tenantId).toBe('default');
    });
  });

  describe('authenticateToken', () => {
    it('round-trips through login → authenticateToken', async () => {
      const svc = makeService();
      const { token } = await svc.login('admin', 'admin123');
      const principal = await svc.authenticateToken(`Bearer ${token}`);
      expect(principal.username).toBe('admin');
      expect(principal.scope).toBe('platform');
    });

    it('throws without Bearer prefix', async () => {
      const svc = makeService();
      await expect(svc.authenticateToken('just-a-token')).rejects.toThrow('bearer token required');
    });

    it('throws for empty token', async () => {
      const svc = makeService();
      await expect(svc.authenticateToken('Bearer ')).rejects.toThrow('bearer token required');
    });

    it('throws for invalid token', async () => {
      const svc = makeService();
      await expect(svc.authenticateToken('Bearer invalid.token.here')).rejects.toThrow(
        'invalid token'
      );
    });
  });

  describe('ensurePermission', () => {
    it('passes for wildcard permission', async () => {
      const svc = makeService();
      const { user } = await svc.login('admin', 'admin123');
      expect(svc.ensurePermission(user, 'anything')).toBe(true);
    });

    it('passes for matching specific permission', async () => {
      const svc = makeService();
      const { user } = await svc.login('ops', 'ops123');
      expect(svc.ensurePermission(user, 'tenant:instance:read')).toBe(true);
    });

    it('throws for missing permission', async () => {
      const svc = makeService();
      const { user } = await svc.login('ops', 'ops123');
      expect(() => svc.ensurePermission(user, 'tenant:user:write')).toThrow('permission denied');
    });

    it('passes for empty requested permission', async () => {
      const svc = makeService();
      const { user } = await svc.login('ops', 'ops123');
      expect(svc.ensurePermission(user, '')).toBe(true);
    });
  });

  describe('AuthProviderRegistry', () => {
    it('lists registered providers', () => {
      const svc = makeService();
      const types = svc.getRegistry().listRegistered();
      expect(types).toContain('local');
    });

    it('throws for unregistered provider type', () => {
      const registry = new AuthProviderRegistry('local');
      expect(() => registry.getProvider(null)).toThrow('No provider registered for type "local"');
    });
  });
});
