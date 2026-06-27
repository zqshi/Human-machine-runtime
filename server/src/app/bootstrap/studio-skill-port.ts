/**
 * StudioService skill port 适配(v1.2.2 T47)。
 *
 * 把 shared-assets 的 ISkillRepository + createAssetBinding 适配成 agent-core domain
 * 的 ISkillPort(用例级封装),注入 StudioService。
 *
 * 仿 assembly-provider.ts 的 adaptContentStore 模式(SkillRepository → IContentStorePort
 * 精简视图映射)。本适配层是依赖组装顶层,允许 import shared-assets 的 repo/domain
 * (agent-core domain 不行,故经此 port 解耦,守 §1.3)。
 *
 * installAssetBinding 封装 createAssetBinding + 幂等去重(findAssetBinding→已存在返回 /
 * 否则构造+存储),去重逻辑下沉到此(原在 studio-service.installAsset)。
 */
import { createAssetBinding } from '../../contexts/shared-assets/domain/shared-skill.js';
import type { ISkillRepository } from '../../contexts/shared-assets/skill-service.js';
import type { SharedAsset, AssetBinding } from '../../contexts/shared-assets/domain/shared-skill.js';
import type {
  ISkillPort,
  SkillAssetView,
  AssetBindingView,
} from '../../contexts/agent-core/domain/skill-port.js';

/** SharedAsset → 跨边界精简视图(只暴露 studio-service 用到的字段) */
function toAssetView(a: SharedAsset): SkillAssetView {
  return {
    id: a.id,
    name: a.name,
    assetType: a.assetType,
    description: a.description,
    version: a.version,
    status: a.status,
    updatedAt: a.updatedAt,
  };
}

/** AssetBinding → 跨边界精简视图 */
function toBindingView(b: AssetBinding): AssetBindingView {
  return {
    id: b.id,
    assetId: b.assetId,
    skillId: b.skillId,
    assetType: b.assetType,
    updatedAt: b.updatedAt,
  };
}

export function adaptSkillPort(repo: ISkillRepository): ISkillPort {
  return {
    async listSharedAssets() {
      return (await repo.listSharedAssets()).map(toAssetView);
    },
    async listBindingsByTenant(tenantId) {
      return (await repo.listBindingsByTenant(tenantId)).map(toBindingView);
    },
    async getSharedAssetsByIds(ids) {
      return (await repo.getSharedAssetsByIds(ids)).map(toAssetView);
    },
    async getSharedAsset(assetId) {
      const a = await repo.getSharedAsset(assetId);
      return a ? toAssetView(a) : null;
    },
    async installAssetBinding(tenantId, assetId, assetType, actor) {
      // 幂等:已存在绑定直接返回 existing id(不重复构造/插入)
      const existing = await repo.findAssetBinding(tenantId, assetId);
      if (existing) return { id: existing.id };
      const binding = createAssetBinding(tenantId, assetId, assetType, actor);
      await repo.addAssetBinding(binding);
      return { id: binding.id };
    },
    async uninstallAssetBinding(tenantId, assetId) {
      const binding = await repo.findAssetBinding(tenantId, assetId);
      if (!binding) return false;
      return repo.removeAssetBinding(binding.id);
    },
  };
}
