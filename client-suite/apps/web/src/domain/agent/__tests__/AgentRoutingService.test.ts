import { describe, it, expect } from 'vitest';
import { AgentRoutingService } from '../AgentRoutingService';
import { CapabilityRegistry } from '../CapabilityRegistry';
import { AgentCapabilityProfile } from '../AgentCapabilityProfile';
import { TaskContract } from '../TaskContract';

describe('AgentRoutingService', () => {
  describe('detectIntent', () => {
    it('returns null for generic text', () => {
      expect(AgentRoutingService.detectIntent('你好')).toBeNull();
    });

    it('detects single keyword match', () => {
      const intent = AgentRoutingService.detectIntent('帮我审查安全漏洞');
      expect(intent).not.toBeNull();
      expect(intent!.templateId).toBe('cap-security');
      expect(intent!.matchedKeywords).toContain('安全');
      expect(intent!.confidence).toBeGreaterThanOrEqual(0.5);
    });

    it('picks the best match when multiple patterns match', () => {
      const intent = AgentRoutingService.detectIntent('帮我开发代码并编写API接口开发文档');
      expect(intent).not.toBeNull();
      expect(intent!.templateId).toBe('cap-dev');
      expect(intent!.matchedKeywords.length).toBeGreaterThan(1);
    });

    it('confidence scales with keyword count up to 0.95', () => {
      const intent = AgentRoutingService.detectIntent('代码开发编程重构debug编译API');
      expect(intent).not.toBeNull();
      expect(intent!.confidence).toBe(0.95);
    });
  });

  describe('route', () => {
    it('returns create when no active agent exists', () => {
      const registry = CapabilityRegistry.createDefault();
      const intent = { templateId: 'cap-dev', confidence: 0.8, matchedKeywords: ['代码'] };
      const result = AgentRoutingService.route(intent, registry);
      expect(result).not.toBeNull();
      expect(result!.action).toBe('create');
    });

    it('returns null for unknown template', () => {
      const registry = CapabilityRegistry.createDefault();
      const intent = { templateId: 'cap-nonexistent', confidence: 0.8, matchedKeywords: [] };
      expect(AgentRoutingService.route(intent, registry)).toBeNull();
    });
  });

  describe('routeWithScoring', () => {
    const contract = TaskContract.create({
      objective: 'analyze data',
      inputs: ['dataset.csv'],
      acceptanceCriteria: [],
      constraints: [],
      escalationConditions: [],
      estimatedCostTokens: 1000,
      estimatedDurationMs: 60000,
      publishedIntents: ['data-analysis'],
    });

    it('falls back to basic route when no profiles match', () => {
      const registry = CapabilityRegistry.createDefault();
      const intent = { templateId: 'cap-data', confidence: 0.8, matchedKeywords: ['数据'] };
      const result = AgentRoutingService.routeWithScoring(intent, registry, [], contract);
      expect(result).not.toBeNull();
      expect(result!.agentScore).toBeNull();
      expect(result!.routeResult.action).toBe('create');
    });

    it('returns scored result when profiles have matching domain', () => {
      const registry = CapabilityRegistry.createDefault();
      const profile = AgentCapabilityProfile.create({
        agentId: 'agent-1',
        name: 'Data Agent',
        domains: [
          {
            domain: 'data-analysis',
            successRate: 0.9,
            totalExecutions: 50,
            avgDurationMs: 3000,
            avgTokenCost: 800,
          },
        ],
      });
      const intent = { templateId: 'cap-data', confidence: 0.8, matchedKeywords: ['数据'] };
      const result = AgentRoutingService.routeWithScoring(intent, registry, [profile], contract);
      expect(result).not.toBeNull();
      expect(result!.agentScore).not.toBeNull();
      expect(result!.agentScore!.agentId).toBe('agent-1');
      expect(result!.agentScore!.totalScore).toBeGreaterThan(0);
    });
  });

  describe('getDomainForTemplate', () => {
    it('returns domain for known template', () => {
      expect(AgentRoutingService.getDomainForTemplate('cap-dev')).toBe('development');
      expect(AgentRoutingService.getDomainForTemplate('cap-security')).toBe('security');
    });

    it('returns undefined for unknown template', () => {
      expect(AgentRoutingService.getDomainForTemplate('cap-nope')).toBeUndefined();
    });
  });
});
