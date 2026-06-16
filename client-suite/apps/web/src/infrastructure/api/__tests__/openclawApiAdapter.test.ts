import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenClawApiAdapter } from '../openclawApiAdapter';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function jsonResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    text: () => Promise.resolve(JSON.stringify(data)),
    json: () => Promise.resolve(data),
  };
}

describe('OpenClawApiAdapter', () => {
  let adapter: OpenClawApiAdapter;

  beforeEach(() => {
    adapter = new OpenClawApiAdapter();
    mockFetch.mockReset();
  });

  describe('fetchDecisions', () => {
    it('maps DTO to DecisionRequest entities', async () => {
      const dto = {
        items: [
          {
            id: 'dec-1',
            agentId: 'ops-assistant',
            title: 'CPU 告警',
            context: '需要扩容',
            recommendation: {
              id: 'opt-1',
              label: '扩容',
              description: '',
              reasoning: '',
              estimatedImpact: '',
              riskLevel: 'low',
            },
            alternatives: [],
            urgency: 'high',
            deadline: Date.now() + 60000,
            responseStatus: 'pending',
            createdAt: Date.now(),
            impactScope: 3,
            downstreamTaskIds: [],
            downstreamGoalIds: [],
          },
        ],
      };
      mockFetch.mockResolvedValue(jsonResponse(dto));
      const result = await adapter.fetchDecisions();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('dec-1');
      expect(result[0].title).toBe('CPU 告警');
      expect(result[0].isPending).toBe(true);
    });

    it('passes status filter as query param', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ items: [] }));
      await adapter.fetchDecisions({ status: 'pending' });
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/openclaw/decisions?status=pending',
        expect.objectContaining({ credentials: 'include' })
      );
    });
  });

  describe('respondDecision', () => {
    it('sends POST with action and returns updated decision', async () => {
      const updated = {
        decision: {
          id: 'dec-1',
          agentId: 'ops',
          title: 'test',
          context: 'ctx',
          recommendation: {
            id: 'o1',
            label: 'a',
            description: '',
            reasoning: '',
            estimatedImpact: '',
            riskLevel: 'low',
          },
          alternatives: [],
          urgency: 'normal',
          deadline: Date.now(),
          responseStatus: 'accepted',
          userResponse: 'ok',
          responseAt: Date.now(),
          createdAt: Date.now() - 1000,
          impactScope: 1,
          downstreamTaskIds: [],
          downstreamGoalIds: [],
        },
      };
      mockFetch.mockResolvedValue(jsonResponse(updated));
      const result = await adapter.respondDecision('dec-1', 'accept', { feedback: 'good' });
      expect(result.responseStatus).toBe('accepted');
      const [, init] = mockFetch.mock.calls[0];
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body)).toMatchObject({ action: 'accept', feedback: 'good' });
    });
  });

  describe('fetchTasks', () => {
    it('maps DTO to AgentTask entities', async () => {
      mockFetch.mockResolvedValue(
        jsonResponse({
          items: [
            {
              id: 'task-1',
              agentId: 'dev',
              name: '部署',
              status: 'running',
              progress: 50,
              subtasks: [],
              logs: [],
              createdAt: 1000,
              updatedAt: 2000,
            },
          ],
        })
      );
      const result = await adapter.fetchTasks();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('部署');
      expect(result[0].isActive).toBe(true);
    });
  });

  describe('updateTask', () => {
    it('sends PATCH and returns updated task', async () => {
      mockFetch.mockResolvedValue(
        jsonResponse({
          id: 'task-1',
          agentId: 'dev',
          name: '部署',
          status: 'paused',
          progress: 50,
          subtasks: [],
          logs: [],
          createdAt: 1000,
          updatedAt: 3000,
        })
      );
      const result = await adapter.updateTask('task-1', { status: 'paused' });
      expect(result.status).toBe('paused');
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe('/api/openclaw/tasks/task-1');
      expect(init.method).toBe('PATCH');
    });
  });

  describe('fetchGoals', () => {
    it('maps DTO to UserGoal entities', async () => {
      mockFetch.mockResolvedValue(
        jsonResponse({
          items: [
            {
              id: 'goal-1',
              title: '安全加固',
              description: '修复漏洞',
              priority: 'high',
              status: 'active',
              milestones: [],
              progressUpdates: [],
              relatedTaskIds: [],
              relatedDecisionIds: [],
              createdAt: 1000,
              updatedAt: 2000,
            },
          ],
        })
      );
      const result = await adapter.fetchGoals();
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('安全加固');
    });
  });

  describe('fetchJudgmentRecords', () => {
    it('maps DTO to JudgmentRecord entities', async () => {
      mockFetch.mockResolvedValue(
        jsonResponse({
          items: [
            {
              id: 'jr-1',
              decisionId: 'dec-1',
              source: 'risk-rule-trigger',
              action: 'accepted',
              respondedAt: 2000,
              createdAt: 1000,
              contextSnapshot: {
                title: 'test',
                context: 'ctx',
                urgency: 'high',
                recommendationLabel: 'act',
                alternativeCount: 1,
              },
            },
          ],
        })
      );
      const result = await adapter.fetchJudgmentRecords({ decisionId: 'dec-1' });
      expect(result).toHaveLength(1);
      expect(result[0].decisionId).toBe('dec-1');
      expect(result[0].responseDurationMs).toBe(1000);
    });
  });

  describe('error handling', () => {
    it('throws on non-ok response', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ error: 'not found' }, 404));
      await expect(adapter.fetchDecisions()).rejects.toThrow('API 404');
    });
  });
});
