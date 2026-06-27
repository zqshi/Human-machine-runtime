import {
  employeeApi,
  employeeDetailApi,
  evalApi,
  skillApi,
  toolApi,
  employeeMemoryApi,
  type Employee,
} from '../services/adminApi';

type CreateEmployeeApi = typeof employeeApi;
type EmployeeDetailApi = typeof employeeDetailApi;
type ToolApi = typeof toolApi;
type SkillApi = typeof skillApi;
type EvalApi = typeof evalApi;
type EmployeeMemoryApi = typeof employeeMemoryApi;

export interface OrganizationEmployeeCreateDraft {
  basic: {
    name: string;
    description: string;
    department: string;
    departmentId: string;
    ownerId: string;
    channelId: string;
    channelAppId: string;
    channelName: string;
    agentRuntime: 'cockpit' | 'harness';
    modelId: string;
    systemPrompt: string;
    enableMemory: boolean;
    memorySearchMode: 'keyword' | 'hybrid' | 'vector';
  };
  capabilities: {
    toolDefinitionIds: string[];
    skillIds: string[];
  };
  evaluation: {
    suiteId: string;
    runBaselineAfterCreate: boolean;
  };
  version: {
    versionName: string;
    releaseNote: string;
    publishAfterCreate: boolean;
  };
}

export interface CreateOrganizationEmployeeResult {
  employee: Employee;
  warnings: string[];
}

interface CreateOrganizationEmployeeDeps {
  employeeApi: CreateEmployeeApi;
  employeeDetailApi: EmployeeDetailApi;
  toolApi: ToolApi;
  skillApi: SkillApi;
  evalApi: EvalApi;
  employeeMemoryApi: EmployeeMemoryApi;
}

const defaultDeps: CreateOrganizationEmployeeDeps = {
  employeeApi,
  employeeDetailApi,
  toolApi,
  skillApi,
  evalApi,
  employeeMemoryApi,
};

export async function createOrganizationEmployee(
  draft: OrganizationEmployeeCreateDraft,
  deps: CreateOrganizationEmployeeDeps = defaultDeps
): Promise<CreateOrganizationEmployeeResult> {
  const name = draft.basic.name.trim();
  if (!name) throw new Error('员工名称不能为空');
  const channelId = draft.basic.channelId.trim();
  const channelAppId = draft.basic.channelAppId.trim();
  if (!channelId || !channelAppId) throw new Error('请选择要绑定的 Channel 应用');

  const employee = await deps.employeeApi.create({
    name,
    scope: 'organization',
    department: draft.basic.department.trim(),
    departmentId: draft.basic.departmentId.trim() || undefined,
    role: draft.basic.agentRuntime,
    riskLevel: 'L1',
    ownerId: draft.basic.ownerId.trim() || undefined,
    channelId,
    channelAppId,
    description: draft.basic.description.trim(),
  });

  const warnings: string[] = [];
  const employeeId = employee.id;

  await collectWarning(
    warnings,
    '基础运行配置保存失败，请创建后在编辑页补齐。',
    () =>
      deps.employeeDetailApi.updateProfile(employeeId, {
        name,
        department: draft.basic.department.trim(),
        departmentId: draft.basic.departmentId.trim() || undefined,
        jobTitle: draft.basic.agentRuntime,
        knowMe: draft.basic.description.trim(),
        channelBinding: {
          channelId,
          appId: channelAppId,
          name: draft.basic.channelName.trim(),
        },
        runtimeProfile: {
          modelId: draft.basic.modelId,
          systemPrompt: draft.basic.systemPrompt.trim(),
        },
        capabilities: draft.capabilities.toolDefinitionIds,
        linkedSkillIds: draft.capabilities.skillIds,
        evaluationConfig: draft.evaluation.suiteId
          ? {
              suiteId: draft.evaluation.suiteId,
              runBaselineAfterCreate: draft.evaluation.runBaselineAfterCreate,
            }
          : null,
        versions: [
          {
            version: draft.version.versionName.trim() || 'v0.1.0',
            releaseNote: draft.version.releaseNote.trim(),
            status: draft.version.publishAfterCreate ? 'published' : 'draft',
          },
        ],
      })
  );

  for (const definitionId of draft.capabilities.toolDefinitionIds) {
    await collectWarning(warnings, `工具 ${definitionId} 绑定失败，请创建后重试。`, () =>
      deps.toolApi.bindTool({ definitionId, instanceId: employeeId })
    );
  }

  for (const skillId of draft.capabilities.skillIds) {
    await collectWarning(warnings, `Skill ${skillId} 绑定失败，请创建后重试。`, () =>
      deps.skillApi.link(skillId, { employeeId })
    );
  }

  if (draft.evaluation.suiteId && draft.evaluation.runBaselineAfterCreate) {
    await collectWarning(warnings, '基线评测启动失败，请创建后在评测管理中手动运行。', () =>
      deps.evalApi.startRun({
        suiteId: draft.evaluation.suiteId,
        triggerType: 'manual',
        configVersion: draft.version.versionName.trim() || 'v0.1.0',
        employeeId: employeeId,
        environment: 'baseline',
      })
    );
  }

  if (draft.basic.enableMemory) {
    await collectWarning(warnings, '记忆库创建失败，请创建后在记忆库管理中手动创建。', () =>
      deps.employeeMemoryApi.createStore({
        instanceId: employeeId,
        name: `${name} 记忆库`,
        description: `${name} 的用户粒度记忆库`,
        retrievalConfig: {
          useKeywordSearch: draft.basic.memorySearchMode !== 'vector',
          useVectorSearch: draft.basic.memorySearchMode !== 'keyword',
        },
      })
    );
  }

  return { employee, warnings };
}

async function collectWarning(
  warnings: string[],
  message: string,
  action: () => Promise<unknown>
): Promise<void> {
  try {
    await action();
  } catch {
    warnings.push(message);
  }
}
