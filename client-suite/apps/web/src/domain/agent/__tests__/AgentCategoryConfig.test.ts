import { describe, it, expect } from 'vitest';
import { getCategoryDisplay, AGENT_CATEGORY_CONFIG } from '../AgentCategoryConfig';

describe('AgentCategoryConfig', () => {
  it('returns config for known category', () => {
    const display = getCategoryDisplay('dev');
    expect(display).toBe(AGENT_CATEGORY_CONFIG.dev);
    expect(display.label).toBe('开发');
  });

  it('returns default for unknown category', () => {
    const display = getCategoryDisplay('nonexistent');
    expect(display.label).toBe('通用');
    expect(display.icon).toBe('smart_toy');
  });

  it('covers all 8 categories', () => {
    const categories = [
      'dev',
      'docs',
      'data',
      'design',
      'test',
      'ops',
      'translate',
      'security',
    ] as const;
    for (const cat of categories) {
      const display = getCategoryDisplay(cat);
      expect(display.label).toBeTruthy();
      expect(display.color).toMatch(/^#/);
    }
  });
});
