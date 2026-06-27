/**
 * Skill 资产查询/安装 port(守 §1.3,agent-core 不依赖 shared-assets context)。
 *
 * StudioService 通过此 port 访问 shared-assets 的 skill/asset 数据 + 安装/卸载,
 * 不直接 import shared-assets 的 ISkillRepository / createAssetBinding(原 T47 跨聚合违规)。
 *
 * 仿 assembly-provider.ts 的 port 模式:IContentStorePort 同样把 SkillRepository
 * 适配为精简视图(port 只暴露消费方用到的字段,跨边界值对象)。bootstrap 由
 * shared-assets 适配注入(adaptSkillPort,见 app/bootstrap/studio-skill-port.ts)。
 *
 * installAssetBinding/uninstallAssetBinding 是用例级封装(非 repo 透传):
 * 把 createAssetBinding + findAssetBinding + addAssetBinding 合并,去重逻辑下沉,
 * agent-core 不接触 shared-assets 的 AssetBinding 类型。
 */

/** studio-service 消费的共享资产视图(精简自 SharedAsset,跨边界值对象) */
export interface SkillAssetView {
  id: string;
  name: string;
  assetType: string;
  description: string;
  version: string;
  status: string;
  updatedAt: string;
}

/** studio-service 消费的资产绑定视图(精简自 AssetBinding) */
export interface AssetBindingView {
  id: string;
  assetId?: string;
  skillId?: string;
  assetType: string;
  updatedAt: string;
}

export interface ISkillPort {
  /** 列组织共享资产(studio listAssets 的 shared 项) */
  listSharedAssets(): Promise<SkillAssetView[]>;
  /** 按 tenantId 列已安装绑定(listAssets 的 installed 项) */
  listBindingsByTenant(tenantId: string): Promise<AssetBindingView[]>;
  /** 批量按 id 查共享资产(installed 资产解析 + skillRefs 解析) */
  getSharedAssetsByIds(ids: string[]): Promise<SkillAssetView[]>;
  /** 单查资产(installAsset 取 assetType + 存在性) */
  getSharedAsset(assetId: string): Promise<SkillAssetView | null>;
  /**
   * 安装资产(幂等):已存在绑定返回 existing id,否则构造 binding + 存储。
   * 封装 createAssetBinding + findAssetBinding + addAssetBinding,agent-core 不接触 binding 类型。
   */
  installAssetBinding(
    tenantId: string,
    assetId: string,
    assetType: string,
    actor: string
  ): Promise<{ id: string }>;
  /** 卸载资产(find + remove,不存在返回 false) */
  uninstallAssetBinding(tenantId: string, assetId: string): Promise<boolean>;
}
