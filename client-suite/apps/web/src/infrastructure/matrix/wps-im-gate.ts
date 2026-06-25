/**
 * WPS IM 通道启用守卫(D11)。
 *
 * 投产未接入 WPS IM 通道(决策 2026-06-25),WpsImAdapter 的 7 个方法
 * (editMessage/redactMessage/createDmRoom/inviteToRoom/createGroupRoom/
 * joinRoom/leaveRoom)仍是 NotImplementedError。
 *
 * 风险路径:localStorage 残留 wps-token → 会话恢复触发 loginWps →
 * 实例化 WpsImAdapter → 调用未实现方法抛 NotImplementedError。
 *
 * 守卫:未显式启用(VITE_WPS_IM_ENABLED=true)时禁止实例化 WpsImAdapter,
 * fail-fast 暴露问题而非让未实现方法在运行时随机炸裂。
 *
 * 启用该通道时,需先对照 WPS IM 协议(farmBaseUrl API)补齐 7 个方法,
 * 再设 VITE_WPS_IM_ENABLED=true。
 */
export function isWpsImEnabled(): boolean {
  return import.meta.env.VITE_WPS_IM_ENABLED === 'true';
}
