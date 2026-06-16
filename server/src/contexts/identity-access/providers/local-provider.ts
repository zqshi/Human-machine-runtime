import bcrypt from 'bcryptjs';
import type { IAuthProvider, AuthResult, LocalProviderConfig } from '../auth-provider.js';

export interface LocalCredentials {
  username: string;
  password: string;
}

export interface ILocalUserStore {
  findByUsername(username: string): Promise<LocalUserRecord | null>;
}

export interface LocalUserRecord {
  username: string;
  passwordHash: string;
  email?: string;
  displayName?: string;
  disabled?: boolean;
}

export class LocalAuthProvider implements IAuthProvider {
  readonly type = 'local';
  private store: ILocalUserStore;
  private config: LocalProviderConfig;

  constructor(store: ILocalUserStore, config: LocalProviderConfig = {}) {
    this.store = store;
    this.config = config;
  }

  async authenticate(credentials: unknown): Promise<AuthResult> {
    const creds = credentials as LocalCredentials;
    if (!creds?.username || !creds?.password) {
      throw new Error('username and password required');
    }

    const user = await this.store.findByUsername(creds.username);
    if (!user || user.disabled) {
      throw new Error('invalid username or password');
    }

    const ok = await this.verifyPassword(creds.password, user.passwordHash);
    if (!ok) {
      throw new Error('invalid username or password');
    }

    return {
      externalId: user.username,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
    };
  }

  private async verifyPassword(input: string, stored: string): Promise<boolean> {
    if (!stored) return false;
    if (stored.startsWith('plain:')) {
      return this.config.allowPlainPassword ? input === stored.slice(6) : false;
    }
    if (stored.startsWith('bcrypt:')) {
      return bcrypt.compare(input, stored.slice(7));
    }
    return bcrypt.compare(input, stored);
  }
}
