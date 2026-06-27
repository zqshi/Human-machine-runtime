import { describe, it, expect, vi } from 'vitest';
import { adaptSkillPort } from './studio-skill-port.js';

/**
 * T47:adaptSkillPort 适配层单测。
 *
 * 验证 shared-assets ISkillRepository + createAssetBinding → agent-core ISkillPort 的:
 * ① 视图映射(SharedAsset/AssetBinding → 精简 view,只暴露消费字段)
 * ② installAssetBinding 幂等去重(已存在返回 existing id 不重复插入,无则构造+存储)
 * ③ uninstallAssetBinding(find+remove,无绑定返回 false)
 *
 * 这些逻辑从 studio-service.installAsset 下沉到此(T47 解耦时一并迁移)。
 */
function makeRepoMock() {
  return {
    listSharedAssets: vi.fn(async () => []),
    listBindingsByTenant: vi.fn(async () => []),
    getSharedAssetsByIds: vi.fn(async () => []),
    getSharedAsset: vi.fn(async () => null),
    findAssetBinding: vi.fn(async () => null),
    addAssetBinding: vi.fn(async () => undefined),
    removeAssetBinding: vi.fn(async () => true),
    // ISkillRepository 其余方法不影响 adaptSkillPort,补占位以满足结构子类型
    addAssetReport: vi.fn(async () => undefined),
    getAssetReport: vi.fn(async () => null),
    updateAssetReport: vi.fn(async () => undefined),
    listAssetReports: vi.fn(async () => []),
    getContentsByIds: vi.fn(async () => new Map()),
    addSharedAsset: vi.fn(async () => undefined),
    updateSharedAsset: vi.fn(async () => undefined),
    deleteSharedAsset: vi.fn(async () => true),
    listAssetBindings: vi.fn(async () => []),
    findBindingsByAsset: vi.fn(async () => []),
  };
}

describe('adaptSkillPort', () => {
  it('listSharedAssets 映射 SharedAsset → SkillAssetView(只暴露消费字段,丢弃 content/tags 等)', async () => {
    const repo = makeRepoMock();
    repo.listSharedAssets.mockResolvedValue([
      {
        id: 'sa_1',
        name: '报告',
        assetType: 'skill',
        description: '生成报告',
        content: '...',
        contentRef: null,
        version: '2.0',
        status: 'active',
        updatedAt: '2026-01-01T00:00:00Z',
        sourceReportId: 'r1',
        sourceTenantId: 'tn0',
        sourceInstanceId: 'inst0',
        tags: [],
        publishedBy: 'admin',
        publishedAt: '',
        createdAt: '',
      },
    ]);
    const port = adaptSkillPort(repo as never);
    const assets = await port.listSharedAssets();
    expect(assets).toHaveLength(1);
    expect(assets[0]).toEqual({
      id: 'sa_1',
      name: '报告',
      assetType: 'skill',
      description: '生成报告',
      version: '2.0',
      status: 'active',
      updatedAt: '2026-01-01T00:00:00Z',
    });
  });

  it('listBindingsByTenant 映射 AssetBinding → AssetBindingView', async () => {
    const repo = makeRepoMock();
    repo.listBindingsByTenant.mockResolvedValue([
      {
        id: 'b1',
        tenantId: 'tn1',
        assetId: 'sa_1',
        skillId: undefined,
        assetType: 'skill',
        status: 'active',
        createdBy: 'x',
        createdAt: '',
        updatedAt: '2026-01-02T00:00:00Z',
      },
    ]);
    const port = adaptSkillPort(repo as never);
    const bindings = await port.listBindingsByTenant('tn1');
    expect(bindings[0]).toEqual({
      id: 'b1',
      assetId: 'sa_1',
      skillId: undefined,
      assetType: 'skill',
      updatedAt: '2026-01-02T00:00:00Z',
    });
  });

  it('getSharedAsset null → null', async () => {
    const repo = makeRepoMock();
    const port = adaptSkillPort(repo as never);
    expect(await port.getSharedAsset('missing')).toBeNull();
  });

  it('installAssetBinding 幂等:已存在绑定返回 existing id,不构造/插入', async () => {
    const repo = makeRepoMock();
    repo.findAssetBinding.mockResolvedValue({
      id: 'existing_b1',
      tenantId: 'tn1',
      assetId: 'sa_1',
      assetType: 'skill',
      status: 'active',
      createdBy: 'x',
      createdAt: '',
      updatedAt: '',
    });
    const port = adaptSkillPort(repo as never);
    const result = await port.installAssetBinding('tn1', 'sa_1', 'skill', 'studio');
    expect(result).toEqual({ id: 'existing_b1' });
    expect(repo.addAssetBinding).not.toHaveBeenCalled();
  });

  it('installAssetBinding 新建:无既有绑定 → createAssetBinding + addAssetBinding,返回新 id', async () => {
    const repo = makeRepoMock();
    repo.findAssetBinding.mockResolvedValue(null);
    const port = adaptSkillPort(repo as never);
    const result = await port.installAssetBinding('tn1', 'sa_1', 'tool', 'studio');
    expect(result.id).toMatch(/^asset_binding/);
    expect(repo.addAssetBinding).toHaveBeenCalledOnce();
    const binding = repo.addAssetBinding.mock.calls[0][0];
    expect(binding.tenantId).toBe('tn1');
    expect(binding.assetId).toBe('sa_1');
    expect(binding.assetType).toBe('tool');
    expect(binding.createdBy).toBe('studio');
    expect(binding.status).toBe('active');
  });

  it('uninstallAssetBinding 无绑定 → false,不调 remove', async () => {
    const repo = makeRepoMock();
    repo.findAssetBinding.mockResolvedValue(null);
    const port = adaptSkillPort(repo as never);
    expect(await port.uninstallAssetBinding('tn1', 'sa_1')).toBe(false);
    expect(repo.removeAssetBinding).not.toHaveBeenCalled();
  });

  it('uninstallAssetBinding 有绑定 → remove(binding.id) → true', async () => {
    const repo = makeRepoMock();
    repo.findAssetBinding.mockResolvedValue({
      id: 'b1',
      tenantId: 'tn1',
      assetId: 'sa_1',
      assetType: 'skill',
      status: 'active',
      createdBy: 'x',
      createdAt: '',
      updatedAt: '',
    });
    const port = adaptSkillPort(repo as never);
    expect(await port.uninstallAssetBinding('tn1', 'sa_1')).toBe(true);
    expect(repo.removeAssetBinding).toHaveBeenCalledWith('b1');
  });
});
