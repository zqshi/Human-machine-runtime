import type { IAuthProvider } from './auth-provider.js';

export class AuthProviderRegistry {
  private providers = new Map<string, IAuthProvider>();
  private tenantProviders = new Map<string, string>();
  private defaultProviderType: string;

  constructor(defaultProviderType = 'local') {
    this.defaultProviderType = defaultProviderType;
  }

  register(provider: IAuthProvider): void {
    this.providers.set(provider.type, provider);
  }

  setTenantProvider(tenantId: string, providerType: string): void {
    if (!this.providers.has(providerType)) {
      throw new Error(`Provider type "${providerType}" not registered`);
    }
    this.tenantProviders.set(tenantId, providerType);
  }

  getProvider(tenantId?: string | null): IAuthProvider {
    const type = tenantId
      ? (this.tenantProviders.get(tenantId) ?? this.defaultProviderType)
      : this.defaultProviderType;
    const provider = this.providers.get(type);
    if (!provider) {
      throw new Error(`No provider registered for type "${type}"`);
    }
    return provider;
  }

  getProviderByType(type: string): IAuthProvider | undefined {
    return this.providers.get(type);
  }

  getDefaultProvider(): IAuthProvider {
    return this.getProvider(null);
  }

  listRegistered(): string[] {
    return Array.from(this.providers.keys());
  }

  setDefaultType(type: string): void {
    if (!this.providers.has(type)) {
      throw new Error(`Provider type "${type}" not registered`);
    }
    this.defaultProviderType = type;
  }
}
