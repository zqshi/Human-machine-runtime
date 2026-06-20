import { describe, it, expect, vi } from 'vitest';
import { AgentProfileService } from './agent-profile-service.js';

function mockProfileServiceClient() {
  return {
    isConfigured: () => true,
    getAgentProfile: vi.fn().mockResolvedValue({ id: 'a-1', name: 'Bot' }),
    updateAgentProfile: vi.fn().mockResolvedValue({ id: 'a-1', name: 'Updated Bot' }),
    getAgentJourney: vi.fn().mockResolvedValue({ milestones: [] }),
    getUsageSummary: vi.fn().mockResolvedValue({ totalTokens: 1000 }),
    listBlogEntries: vi.fn().mockResolvedValue({ entries: [] }),
  };
}

describe('AgentProfileService', () => {
  it('getProfile delegates to profile-service client', async () => {
    const client = mockProfileServiceClient();
    const svc = new AgentProfileService(client as never);
    const result = await svc.getProfile('a-1');
    expect(result).toEqual({ id: 'a-1', name: 'Bot' });
    expect(client.getAgentProfile).toHaveBeenCalledWith('a-1');
  });

  it('updateProfile delegates to profile-service client', async () => {
    const client = mockProfileServiceClient();
    const svc = new AgentProfileService(client as never);
    await svc.updateProfile('a-1', { name: 'New Name' });
    expect(client.updateAgentProfile).toHaveBeenCalledWith('a-1', { name: 'New Name' });
  });

  it('getJourney delegates to profile-service client', async () => {
    const client = mockProfileServiceClient();
    const svc = new AgentProfileService(client as never);
    const result = await svc.getJourney('a-1');
    expect(result).toEqual({ milestones: [] });
  });

  it('getUsage delegates to profile-service client', async () => {
    const client = mockProfileServiceClient();
    const svc = new AgentProfileService(client as never);
    await svc.getUsage('a-1', '7d');
    expect(client.getUsageSummary).toHaveBeenCalledWith('a-1', '7d');
  });

  it('listBlog passes pagination params', async () => {
    const client = mockProfileServiceClient();
    const svc = new AgentProfileService(client as never);
    await svc.listBlog('a-1', 2, 10);
    expect(client.listBlogEntries).toHaveBeenCalledWith('a-1', { page: 2, pageSize: 10 });
  });
});
