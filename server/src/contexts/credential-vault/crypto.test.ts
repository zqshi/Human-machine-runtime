import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from './crypto.js';

describe('credential-vault crypto', () => {
  const key = 'test-key-for-credential-vault!!';

  it('round-trips encrypt/decrypt', () => {
    const plaintext = 'my-secret-api-key-12345';
    const ciphertext = encrypt(plaintext, key);
    expect(ciphertext).not.toBe(plaintext);
    expect(decrypt(ciphertext, key)).toBe(plaintext);
  });

  it('produces different ciphertext each time (random IV)', () => {
    const plaintext = 'same-input';
    const a = encrypt(plaintext, key);
    const b = encrypt(plaintext, key);
    expect(a).not.toBe(b);
    expect(decrypt(a, key)).toBe(plaintext);
    expect(decrypt(b, key)).toBe(plaintext);
  });

  it('fails to decrypt with wrong key', () => {
    const ciphertext = encrypt('secret', key);
    expect(() => decrypt(ciphertext, 'wrong-key-that-is-different!!!!')).toThrow();
  });

  it('handles empty string', () => {
    const ciphertext = encrypt('', key);
    expect(decrypt(ciphertext, key)).toBe('');
  });

  it('handles unicode content', () => {
    const plaintext = '密钥内容 🔑 emoji test';
    const ciphertext = encrypt(plaintext, key);
    expect(decrypt(ciphertext, key)).toBe(plaintext);
  });
});
