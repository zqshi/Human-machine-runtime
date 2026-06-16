import { encrypt, decrypt } from './crypto.js';

export interface CredentialStore {
  saveSecret(authorizationId: number, secretType: string, plaintext: string): Promise<number>;
  getSecret(authorizationId: number, secretType: string): Promise<string | null>;
  deleteSecrets(authorizationId: number): Promise<void>;
}

export class CredentialService {
  private encryptionKey: string;

  constructor(encryptionKey: string) {
    this.encryptionKey = encryptionKey;
  }

  encrypt(plaintext: string): string {
    return encrypt(plaintext, this.encryptionKey);
  }

  decrypt(ciphertext: string): string {
    return decrypt(ciphertext, this.encryptionKey);
  }
}
