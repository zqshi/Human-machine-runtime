import { describe, it, expect } from 'vitest';
import { LeaseService } from './lease-service.js';

describe('LeaseService', () => {
  it('generates UUID lease IDs', () => {
    const svc = new LeaseService();
    const id = svc.generateLeaseId();
    expect(id).toMatch(/^[0-9a-f]{8}-/);
  });

  it('generates unique IDs', () => {
    const svc = new LeaseService();
    const ids = new Set(Array.from({ length: 100 }, () => svc.generateLeaseId()));
    expect(ids.size).toBe(100);
  });

  it('computes expiry with default TTL', () => {
    const svc = new LeaseService(3600);
    const before = Date.now();
    const expiry = svc.computeExpiry();
    const after = Date.now();
    expect(expiry.getTime()).toBeGreaterThanOrEqual(before + 3600 * 1000);
    expect(expiry.getTime()).toBeLessThanOrEqual(after + 3600 * 1000);
  });

  it('computes expiry with custom TTL', () => {
    const svc = new LeaseService();
    const before = Date.now();
    const expiry = svc.computeExpiry(60);
    expect(expiry.getTime()).toBeGreaterThanOrEqual(before + 60 * 1000);
  });

  it('detects expired leases', () => {
    const svc = new LeaseService();
    const expired = { leaseId: 'x', userId: 1, providerId: 1, scope: 'read', expiresAt: new Date(Date.now() - 1000) };
    expect(svc.isExpired(expired)).toBe(true);
  });

  it('detects valid leases', () => {
    const svc = new LeaseService();
    const valid = { leaseId: 'x', userId: 1, providerId: 1, scope: 'read', expiresAt: new Date(Date.now() + 60_000) };
    expect(svc.isExpired(valid)).toBe(false);
  });
});
