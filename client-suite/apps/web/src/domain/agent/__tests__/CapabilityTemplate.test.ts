import { describe, it, expect } from 'vitest';
import { CapabilityTemplate, DEFAULT_CAPABILITY_TEMPLATES } from '../CapabilityTemplate';

describe('CapabilityTemplate', () => {
  it('create returns instance with all properties', () => {
    const tpl = CapabilityTemplate.create({
      id: 'cap-test',
      name: '测试',
      category: 'test',
      description: '自动化测试',
      icon: 'bug_report',
      color: '#00C853',
      systemPrompt: 'You are a test engineer.',
    });

    expect(tpl.id).toBe('cap-test');
    expect(tpl.name).toBe('测试');
    expect(tpl.category).toBe('test');
    expect(tpl.description).toBe('自动化测试');
    expect(tpl.icon).toBe('bug_report');
    expect(tpl.color).toBe('#00C853');
    expect(tpl.systemPrompt).toBe('You are a test engineer.');
  });

  it('create is the only way to instantiate (private constructor)', () => {
    const tpl = CapabilityTemplate.create({
      id: 'x',
      name: 'X',
      category: 'dev',
      description: 'd',
      icon: 'i',
      color: '#000',
      systemPrompt: 'p',
    });
    expect(tpl).toBeInstanceOf(CapabilityTemplate);
  });
});

describe('DEFAULT_CAPABILITY_TEMPLATES', () => {
  it('contains 8 templates', () => {
    expect(DEFAULT_CAPABILITY_TEMPLATES).toHaveLength(8);
  });

  it('all templates have unique ids', () => {
    const ids = DEFAULT_CAPABILITY_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all templates have non-empty systemPrompt', () => {
    for (const tpl of DEFAULT_CAPABILITY_TEMPLATES) {
      expect(tpl.systemPrompt.length).toBeGreaterThan(0);
    }
  });

  it('covers all 8 categories', () => {
    const categories = DEFAULT_CAPABILITY_TEMPLATES.map((t) => t.category);
    expect(categories).toEqual(
      expect.arrayContaining([
        'dev',
        'docs',
        'data',
        'design',
        'test',
        'ops',
        'translate',
        'security',
      ])
    );
  });
});
