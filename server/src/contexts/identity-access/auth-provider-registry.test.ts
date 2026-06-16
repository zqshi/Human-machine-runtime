import { describe, it, expect } from 'vitest';
import { AuthProviderRegistry } from './auth-provider-registry.js';
import type { IAuthProvider } from './auth-provider.js';

function fakeProvider(type: string): IAuthProvider {
  return {
    type,
    authenticate: async () => ({ externalId: '1', username: 'u' }),
  };
}

describe('AuthProviderRegistry', () => {
  it('registers and retrieves a provider', () => {
    const reg = new AuthProviderRegistry('local');
    const p = fakeProvider('local');
    reg.register(p);
    expect(reg.getProvider(null)).toBe(p);
  });

  it('throws when getting unregistered provider', () => {
    const reg = new AuthProviderRegistry('local');
    expect(() => reg.getProvider(null)).toThrow('No provider registered');
  });

  it('returns tenant-specific provider', () => {
    const reg = new AuthProviderRegistry('local');
    reg.register(fakeProvider('local'));
    reg.register(fakeProvider('oidc'));
    reg.setTenantProvider('tn_1', 'oidc');
    expect(reg.getProvider('tn_1').type).toBe('oidc');
  });

  it('falls back to default when tenant has no override', () => {
    const reg = new AuthProviderRegistry('local');
    reg.register(fakeProvider('local'));
    expect(reg.getProvider('unknown-tenant').type).toBe('local');
  });

  it('throws when setting tenant provider to unregistered type', () => {
    const reg = new AuthProviderRegistry('local');
    expect(() => reg.setTenantProvider('tn_1', 'missing')).toThrow('not registered');
  });

  it('getProviderByType returns undefined for unregistered type', () => {
    const reg = new AuthProviderRegistry();
    expect(reg.getProviderByType('nope')).toBeUndefined();
  });

  it('getProviderByType returns provider when registered', () => {
    const reg = new AuthProviderRegistry();
    const p = fakeProvider('oidc');
    reg.register(p);
    expect(reg.getProviderByType('oidc')).toBe(p);
  });

  it('listRegistered returns all types', () => {
    const reg = new AuthProviderRegistry();
    reg.register(fakeProvider('local'));
    reg.register(fakeProvider('oidc'));
    expect(reg.listRegistered()).toEqual(['local', 'oidc']);
  });

  it('setDefaultType changes default provider', () => {
    const reg = new AuthProviderRegistry('local');
    reg.register(fakeProvider('local'));
    reg.register(fakeProvider('oidc'));
    reg.setDefaultType('oidc');
    expect(reg.getDefaultProvider().type).toBe('oidc');
  });

  it('setDefaultType throws for unregistered type', () => {
    const reg = new AuthProviderRegistry('local');
    expect(() => reg.setDefaultType('missing')).toThrow('not registered');
  });
});
