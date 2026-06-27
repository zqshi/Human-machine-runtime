import { describe, expect, it, vi } from 'vitest';
import {
  createOrganizationEmployee,
  type OrganizationEmployeeCreateDraft,
} from './createOrganizationEmployee';

function makeDraft(
  overrides?: Partial<OrganizationEmployeeCreateDraft>
): OrganizationEmployeeCreateDraft {
  return {
    basic: {
      name: '组织助手',
      description: '处理组织内通用任务',
      department: 'finance',
      departmentId: 'dept-finance',
      ownerId: 'u-1',
      channelId: 'ch-1',
      channelAppId: 'app-finance',
      channelName: '财务应用',
      agentRuntime: 'cockpit',
      modelId: 'gpt-4o',
      systemPrompt: '你是组织助手',
      enableMemory: true,
      memorySearchMode: 'keyword',
    },
    capabilities: {
      toolDefinitionIds: ['tool-1'],
      skillIds: ['skill-1'],
    },
    evaluation: {
      suiteId: 'suite-1',
      runBaselineAfterCreate: true,
    },
    version: {
      versionName: 'v0.1.0',
      releaseNote: '初始版本',
      publishAfterCreate: false,
    },
    ...overrides,
  };
}

function makeDeps() {
  return {
    employeeApi: {
      create: vi.fn().mockResolvedValue({ id: 'emp-1', name: '组织助手' }),
      list: vi.fn(),
      get: vi.fn(),
      requestPersonalInstance: vi.fn(),
    },
    employeeDetailApi: {
      getDetail: vi.fn(),
      updateProfile: vi.fn().mockResolvedValue({ success: true }),
      updatePolicy: vi.fn(),
      updateApprovalPolicy: vi.fn(),
      optimizePolicyPrompt: vi.fn(),
      instanceAction: vi.fn(),
      syncIdentity: vi.fn(),
      getResources: vi.fn(),
      updateResources: vi.fn(),
      resetResources: vi.fn(),
    },
    toolApi: {
      listSources: vi.fn(),
      getSource: vi.fn(),
      createSource: vi.fn(),
      updateSource: vi.fn(),
      deleteSource: vi.fn(),
      syncSource: vi.fn(),
      testConnection: vi.fn(),
      introspectSource: vi.fn(),
      uploadSpec: vi.fn(),
      listDefinitions: vi.fn(),
      getDefinition: vi.fn(),
      updateDefinition: vi.fn(),
      testTool: vi.fn(),
      listInstances: vi.fn(),
      bindTool: vi.fn().mockResolvedValue({ id: 'ti-1' }),
      unbindTool: vi.fn(),
      getStats: vi.fn(),
      getCallLogs: vi.fn(),
    },
    skillApi: {
      list: vi.fn(),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      link: vi.fn().mockResolvedValue({ success: true }),
      unlink: vi.fn(),
      getPolicy: vi.fn(),
      updatePolicy: vi.fn(),
      exportAll: vi.fn(),
      importBatch: vi.fn(),
      listEmployees: vi.fn(),
      getSedimentationPolicy: vi.fn(),
      updateSedimentationPolicy: vi.fn(),
      getFileContent: vi.fn(),
    },
    evalApi: {
      importPreset: vi.fn(),
      listSuites: vi.fn(),
      getSuite: vi.fn(),
      createSuite: vi.fn(),
      updateSuite: vi.fn(),
      deleteSuite: vi.fn(),
      listCases: vi.fn(),
      getCase: vi.fn(),
      createCase: vi.fn(),
      batchCreateCases: vi.fn(),
      updateCase: vi.fn(),
      deleteCase: vi.fn(),
      listRuns: vi.fn(),
      getRun: vi.fn(),
      startRun: vi.fn().mockResolvedValue({ id: 'run-1' }),
      getRunResults: vi.fn(),
      getRunReport: vi.fn(),
      getDashboardMetrics: vi.fn(),
      getDashboardTrends: vi.fn(),
      getCategoryHeatmap: vi.fn(),
      listReplay: vi.fn(),
      reviewReplay: vi.fn(),
      promoteReplay: vi.fn(),
      listAlertRules: vi.fn(),
      createAlertRule: vi.fn(),
      updateAlertRule: vi.fn(),
      deleteAlertRule: vi.fn(),
      listEvaluators: vi.fn(),
      getEvaluator: vi.fn(),
      createEvaluator: vi.fn(),
      updateEvaluator: vi.fn(),
      deleteEvaluator: vi.fn(),
      importEvaluatorPreset: vi.fn(),
    },
    employeeMemoryApi: {
      listStores: vi.fn().mockResolvedValue([]),
      createStore: vi.fn().mockResolvedValue({ id: 'mem-1' }),
      getStore: vi.fn(),
      updateRetrievalConfig: vi.fn(),
      deleteStore: vi.fn(),
      archiveStore: vi.fn(),
      restoreStore: vi.fn(),
      listFragments: vi.fn(),
      addFragment: vi.fn(),
      deleteFragment: vi.fn(),
      listRules: vi.fn(),
      createRule: vi.fn(),
      updateRule: vi.fn(),
      deleteRule: vi.fn(),
      search: vi.fn(),
      verify: vi.fn(),
    },
  };
}

describe('createOrganizationEmployee', () => {
  it('creates organization employee and binds capabilities/evaluation', async () => {
    const deps = makeDeps();
    const result = await createOrganizationEmployee(makeDraft(), deps);

    expect(result.warnings).toEqual([]);
    expect(deps.employeeApi.create).toHaveBeenCalledWith({
      name: '组织助手',
      scope: 'organization',
      department: 'finance',
      departmentId: 'dept-finance',
      role: 'cockpit',
      riskLevel: 'L1',
      ownerId: 'u-1',
      channelId: 'ch-1',
      channelAppId: 'app-finance',
      description: '处理组织内通用任务',
    });
    expect(deps.employeeDetailApi.updateProfile).toHaveBeenCalledWith(
      'emp-1',
      expect.objectContaining({
        channelBinding: { channelId: 'ch-1', appId: 'app-finance', name: '财务应用' },
        runtimeProfile: { modelId: 'gpt-4o', systemPrompt: '你是组织助手' },
      })
    );
    expect(deps.toolApi.bindTool).toHaveBeenCalledWith({
      definitionId: 'tool-1',
      instanceId: 'emp-1',
    });
    expect(deps.skillApi.link).toHaveBeenCalledWith('skill-1', { employeeId: 'emp-1' });
    expect(deps.evalApi.startRun).toHaveBeenCalledWith({
      suiteId: 'suite-1',
      triggerType: 'manual',
      configVersion: 'v0.1.0',
      employeeId: 'emp-1',
      environment: 'baseline',
    });
  });

  it('does not start baseline evaluation when disabled', async () => {
    const deps = makeDeps();
    await createOrganizationEmployee(
      makeDraft({ evaluation: { suiteId: 'suite-1', runBaselineAfterCreate: false } }),
      deps
    );

    expect(deps.evalApi.startRun).not.toHaveBeenCalled();
  });

  it('returns warnings for post-create partial failures', async () => {
    const deps = makeDeps();
    deps.toolApi.bindTool.mockRejectedValueOnce(new Error('bind failed'));

    const result = await createOrganizationEmployee(makeDraft(), deps);

    expect(result.employee.id).toBe('emp-1');
    expect(result.warnings).toEqual(['工具 tool-1 绑定失败，请创建后重试。']);
  });
});
