import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import type { InstanceService } from '../../contexts/tenant-instance/instance-service.js';
import type { ResourceConfig } from '../../contexts/tenant-instance/domain/instance.js';
import type { AgentProfileRepository } from '../../db/repositories/agent-profile-repository.js';
import type { AgentProfileService } from '../../contexts/agent-profile/agent-profile-service.js';
import type { Principal } from '../../middleware/auth.js';
import type {
  ClusterInstanceClient,
  ClusterInstance,
} from '../../contexts/gateway/clients/cluster-instance-client.js';

const instanceActionSchema = z.object({
  action: z.enum(['start', 'stop', 'rebuild']),
});

const createEmployeeSchema = z.object({
  name: z.string().min(1),
  displayName: z.string().optional(),
  department: z.string().optional(),
  departmentId: z.string().optional(),
  role: z.string().optional(),
  jobTitle: z.string().optional(),
  scope: z.enum(['personal', 'organization']).default('organization'),
  ownerId: z.string().optional(),
  channelId: z.string().optional(),
  channelAppId: z.string().optional(),
  riskLevel: z.string().optional(),
  description: z.string().optional(),
});

const profileSchema = z.object({
  name: z.string().optional(),
  department: z.string().optional(),
  departmentId: z.string().optional(),
  jobTitle: z.string().optional(),
  email: z.string().optional(),
  avatar: z.string().optional(),
  knowMe: z.string().optional(),
  skillsDigest: z.string().optional(),
  personality: z.string().optional(),
  runtimeProfile: z.record(z.unknown()).optional(),
  channelBinding: z
    .object({
      channelId: z.string(),
      appId: z.string(),
      name: z.string().optional(),
    })
    .optional(),
  capabilities: z.array(z.string()).optional(),
  linkedSkillIds: z.array(z.string()).optional(),
  evaluationConfig: z.record(z.unknown()).nullable().optional(),
  versions: z.array(z.record(z.unknown())).optional(),
});

const resourceConfigSchema = z.object({
  compute: z
    .object({
      cpu: z.string().optional(),
      memory: z.string().optional(),
      gpu: z.object({ type: z.string(), count: z.number() }).nullable().optional(),
    })
    .optional(),
  model: z
    .object({
      primaryModel: z.string().optional(),
      fallbackModels: z.array(z.string()).optional(),
      maxConcurrency: z.number().min(1).max(100).optional(),
    })
    .optional(),
  budget: z
    .object({
      monthlyLimitCny: z.number().min(0).optional(),
      dailyLimitCny: z.number().min(0).nullable().optional(),
      alertThresholdPct: z.number().min(1).max(100).optional(),
    })
    .optional(),
  storage: z
    .object({
      persistentVolumeSize: z.string().optional(),
      tempStorageSize: z.string().optional(),
    })
    .optional(),
});

function getUser(c: Context): Principal {
  return c.get('user') as Principal;
}

function mapRemoteInstance(r: ClusterInstance) {
  const status = r.status;
  return {
    id: `cm_${r.employeeNumber}`,
    name: r.name || r.podName,
    state: status,
    status,
    tenantId: 'default',
    source: 'cluster-instance',
    scope: r.appKey === 'default' ? 'personal' : 'organization',
    department: '--',
    jobTitle: '--',
    employeeNo: String(r.employeeNumber),
    employeeId: r.userId,
    email: null,
    resources: {
      compute: { cpu: '--', memory: '--', gpu: null },
      model: { primaryModel: 'auto', fallbackModels: [], maxConcurrency: 1 },
      budget: { monthlyLimitCny: 0, dailyLimitCny: null, alertThresholdPct: 80 },
      storage: { persistentVolumeSize: '--', tempStorageSize: '--' },
      source: 'cluster-instance',
    },
    createdAt: r.createdAt,
    updatedAt: r.lastActive,
    remote: {
      appKey: r.appKey,
      podName: r.podName,
      cluster: r.cluster ?? null,
      nodeName: r.nodeName ?? null,
      isActive: r.isActive,
      restarts: r.restarts ?? 0,
      managedBy: r.managedBy,
      runtimeTemplate: r.runtimeTemplate ?? null,
      agentRevision: r.agentRevision ?? null,
      runMode: r.runMode ?? null,
      heartbeat: r.lastActive ?? null,
      healthStatus: r.isActive ? 'healthy' : 'unhealthy',
    },
  };
}

export function createAdminEmployeeRoutes(
  svc: InstanceService,
  agentProfileRepo: AgentProfileRepository,
  agentProfileSvc?: AgentProfileService,
  clusterInstanceClient?: ClusterInstanceClient
) {
  const app = new Hono();

  app.get('/', async (c) => {
    const resourceSource = c.req.query('resourceSource');
    const localInstances = await svc.list(undefined, resourceSource);
    const localItems = localInstances.map((inst) => ({
      id: inst.id,
      name: inst.name,
      state: inst.state,
      status: inst.state,
      tenantId: inst.tenantId,
      source: inst.source,
      department: inst.department,
      departmentId: inst.departmentId,
      jobTitle: inst.jobTitle,
      employeeNo: inst.employeeNo,
      employeeId: inst.employeeId,
      email: inst.email,
      resources: inst.resources,
      createdAt: inst.createdAt,
      updatedAt: inst.updatedAt,
    }));

    if (!clusterInstanceClient?.isConfigured()) {
      return c.json(localItems);
    }

    try {
      const res = await clusterInstanceClient.listInstances();
      if (!res.items?.length) {
        return c.json(localItems);
      }
      const remoteItems = res.items.map(mapRemoteInstance);
      // 合并：远程实例 + 本地独有实例（按 id 去重，远程优先）
      const remoteIds = new Set(remoteItems.map((r: { id: string }) => r.id));
      const localOnly = localItems.filter((l) => !remoteIds.has(l.id));
      return c.json([...remoteItems, ...localOnly]);
    } catch {
      /* cluster-instance unavailable, fall through to local */
      return c.json(localItems);
    }
  });

  app.post('/', async (c) => {
    const body = await c.req.json();
    const parsed = createEmployeeSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'invalid employee', details: parsed.error.flatten() }, 400);
    }
    const data = parsed.data;
    const user = getUser(c);
    const inst = await svc.create({
      tenantId: user.tenantId || 'default',
      name: data.name,
      source: data.scope,
      matrixRoomId: data.channelAppId,
      creator: user.username,
      enterpriseUserId: data.scope === 'personal' ? data.ownerId || null : null,
      jobTitle: data.jobTitle || data.role,
      department: data.department,
      departmentId: data.departmentId,
    });

    const profileSettings: Record<string, unknown> = {};
    if (data.riskLevel !== undefined) profileSettings.riskLevel = data.riskLevel;
    if (data.description !== undefined) profileSettings.description = data.description;
    if (data.channelId && data.channelAppId) {
      profileSettings.channelBinding = { channelId: data.channelId, appId: data.channelAppId };
    }
    if (data.scope !== undefined) profileSettings.scope = data.scope;
    const profile = await agentProfileRepo.upsert(inst.id, inst.tenantId, {
      displayName: data.displayName || data.name,
      knowMe: data.description,
      settings: profileSettings,
    });

    return c.json(
      {
        id: inst.id,
        name: inst.name,
        status: inst.state,
        state: inst.state,
        tenantId: inst.tenantId,
        department: inst.department,
        departmentId: inst.departmentId,
        role: inst.jobTitle,
        jobTitle: inst.jobTitle,
        employeeNo: inst.employeeNo,
        employeeId: inst.employeeId,
        channelId: data.channelId,
        channelAppId: data.channelAppId,
        scope: data.scope,
        ownerId: data.ownerId,
        riskLevel: data.riskLevel,
        description: data.description,
        profile,
      },
      201
    );
  });

  app.get('/:id', async (c) => {
    const inst = await svc.get(c.req.param('id'));
    const profile = await agentProfileRepo.findByInstanceId(inst.id);

    let portalProfile: unknown = null;
    let portalJourney: unknown = null;
    let portalUsage: unknown = null;
    const agentId = inst.employeeId ?? inst.id;
    if (agentProfileSvc) {
      const results = await Promise.allSettled([
        agentProfileSvc.getProfile(agentId),
        agentProfileSvc.getJourney(agentId),
        agentProfileSvc.getUsage(agentId),
      ]);
      portalProfile = results[0].status === 'fulfilled' ? results[0].value : null;
      portalJourney = results[1].status === 'fulfilled' ? results[1].value : null;
      portalUsage = results[2].status === 'fulfilled' ? results[2].value : null;
    }

    return c.json({
      id: inst.id,
      name: inst.name,
      state: inst.state,
      tenantId: inst.tenantId,
      source: inst.source,
      department: inst.department,
      departmentId: inst.departmentId,
      jobTitle: inst.jobTitle,
      employeeNo: inst.employeeNo,
      employeeId: inst.employeeId,
      email: inst.email,
      createdAt: inst.createdAt,
      updatedAt: inst.updatedAt,
      runtime: inst.runtime,
      resources: inst.resources,
      policy: inst.policy,
      approvalPolicy: inst.approvalPolicy,
      profile,
      portalProfile,
      portalJourney,
      portalUsage,
    });
  });

  app.post('/:id/profile', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();
    const parsed = profileSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'invalid profile', details: parsed.error.flatten() }, 400);
    }
    const data = parsed.data;
    const user = getUser(c);

    const inst = await svc.updateProfile(id, data, user.username);

    const profileData: Record<string, unknown> = {};
    if (data.avatar !== undefined) profileData.avatar = data.avatar;
    if (data.knowMe !== undefined) profileData.knowMe = data.knowMe;
    if (data.skillsDigest !== undefined) profileData.skillsDigest = data.skillsDigest;
    if (data.personality !== undefined) profileData.personality = data.personality;
    if (data.name !== undefined) profileData.displayName = data.name;
    const settingsPatch: Record<string, unknown> = {};
    if (data.runtimeProfile !== undefined) settingsPatch.runtimeProfile = data.runtimeProfile;
    if (data.channelBinding !== undefined) settingsPatch.channelBinding = data.channelBinding;
    if (data.capabilities !== undefined) settingsPatch.capabilities = data.capabilities;
    if (data.linkedSkillIds !== undefined) settingsPatch.linkedSkillIds = data.linkedSkillIds;
    if (data.evaluationConfig !== undefined) settingsPatch.evaluationConfig = data.evaluationConfig;
    if (data.versions !== undefined) settingsPatch.versions = data.versions;
    if (Object.keys(settingsPatch).length > 0) profileData.settings = settingsPatch;

    const profile = await agentProfileRepo.upsert(id, inst.tenantId, profileData);

    return c.json({ success: true, instance: inst, profile });
  });

  app.post('/:id/policy', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();
    const user = getUser(c);
    const inst = await svc.updatePolicy(id, body, user.username);
    return c.json({ success: true, policy: inst.policy });
  });

  app.post('/:id/approval-policy', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();
    const user = getUser(c);
    const inst = await svc.updateApprovalPolicy(id, body, user.username);
    return c.json({ success: true, approvalPolicy: inst.approvalPolicy });
  });

  app.post('/:id/optimize-policy-prompt', async (c) => {
    const body = await c.req.json();
    const base = (body.currentPrompt as string) || '';
    return c.json({
      prompt: base
        ? `${base}\n\n[AI 优化] 已根据最佳实践调整策略参数，建议关注执行效率和风险控制。`
        : '请为该数字员工配置合理的执行策略，确保任务分配效率与风险可控。',
    });
  });

  app.post('/:id/instance-action', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();
    const parsed = instanceActionSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'invalid action', details: parsed.error.flatten() }, 400);
    }
    const { action } = parsed.data;
    if (action === 'start') {
      const inst = await svc.start(id);
      return c.json(inst);
    }
    if (action === 'stop') {
      const inst = await svc.stop(id);
      return c.json(inst);
    }
    if (action === 'rebuild') {
      const inst = await svc.rebuild(id);
      return c.json(inst);
    }
    return c.json({ error: `unknown action: ${action}` }, 400);
  });

  app.post('/:id/sync-identity', async (c) => {
    const id = c.req.param('id');
    const inst = await svc.get(id);
    const syncedAt = new Date().toISOString();
    await agentProfileRepo.upsert(id, inst.tenantId, { syncedAt });
    return c.json({ success: true, syncedAt });
  });

  app.get('/:id/resources', async (c) => {
    const inst = await svc.get(c.req.param('id'));
    return c.json({ resources: inst.resources });
  });

  app.put('/:id/resources', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();
    const parsed = resourceConfigSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'invalid resource config', details: parsed.error.flatten() }, 400);
    }
    const user = getUser(c);
    const inst = await svc.updateResources(
      id,
      parsed.data as Partial<ResourceConfig>,
      user.username
    );
    return c.json({ success: true, resources: inst.resources });
  });

  app.post('/:id/resources/reset', async (c) => {
    const id = c.req.param('id');
    const user = getUser(c);
    const inst = await svc.resetResources(id, user.username);
    return c.json({ success: true, resources: inst.resources });
  });

  return app;
}
