import { describe, it, expect } from 'vitest';
import { Subscription } from '../Subscription';

const baseProps = {
  id: 'sub-001',
  name: '行业动态',
  type: 'industry' as const,
  enabled: true,
  frequency: 'daily' as const,
  tags: ['AI', '金融'],
  lastUpdated: '2026-03-06T10:00:00Z',
  description: '追踪行业最新动态',
};

describe('Subscription', () => {
  it('creates a subscription with all fields', () => {
    const sub = Subscription.create(baseProps);
    expect(sub.id).toBe('sub-001');
    expect(sub.name).toBe('行业动态');
    expect(sub.type).toBe('industry');
    expect(sub.enabled).toBe(true);
    expect(sub.frequency).toBe('daily');
    expect(sub.tags).toEqual(['AI', '金融']);
  });

  it('toggles enabled state immutably', () => {
    const sub = Subscription.create(baseProps);
    const toggled = sub.toggleEnabled();
    expect(toggled.enabled).toBe(false);
    expect(sub.enabled).toBe(true); // immutable
  });

  it('preserves other fields after toggle', () => {
    const sub = Subscription.create(baseProps);
    const toggled = sub.toggleEnabled();
    expect(toggled.id).toBe(sub.id);
    expect(toggled.name).toBe(sub.name);
    expect(toggled.tags).toEqual(sub.tags);
  });
});
