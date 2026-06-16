import crypto from 'crypto';

export interface LeaseRecord {
  leaseId: string;
  userId: number;
  providerId: number;
  scope: string;
  expiresAt: Date;
}

export interface LeaseStore {
  create(data: Omit<LeaseRecord, 'leaseId'>): Promise<LeaseRecord>;
  findValid(leaseId: string): Promise<LeaseRecord | null>;
  revoke(leaseId: string): Promise<void>;
  revokeExpired(): Promise<number>;
}

export class LeaseService {
  private defaultTtlSec: number;

  constructor(defaultTtlSec = 3600) {
    this.defaultTtlSec = defaultTtlSec;
  }

  generateLeaseId(): string {
    return crypto.randomUUID();
  }

  computeExpiry(ttlSec?: number): Date {
    return new Date(Date.now() + (ttlSec ?? this.defaultTtlSec) * 1000);
  }

  isExpired(lease: LeaseRecord): boolean {
    return lease.expiresAt.getTime() < Date.now();
  }
}
