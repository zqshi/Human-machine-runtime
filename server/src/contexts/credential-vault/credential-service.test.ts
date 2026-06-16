import { describe, it, expect } from 'vitest';
import { CredentialService } from './credential-service.js';

describe('CredentialService', () => {
  const key = 'a'.repeat(32);
  const svc = new CredentialService(key);

  it('encrypts and decrypts round-trip', () => {
    const plaintext = 'super-secret-token';
    const cipher = svc.encrypt(plaintext);
    expect(cipher).not.toBe(plaintext);
    expect(svc.decrypt(cipher)).toBe(plaintext);
  });

  it('produces different ciphertext for same plaintext (IV)', () => {
    const a = svc.encrypt('same');
    const b = svc.encrypt('same');
    expect(a).not.toBe(b);
  });

  it('handles empty string', () => {
    const cipher = svc.encrypt('');
    expect(svc.decrypt(cipher)).toBe('');
  });

  it('handles unicode content', () => {
    const text = '你好世界 🌍';
    expect(svc.decrypt(svc.encrypt(text))).toBe(text);
  });
});
