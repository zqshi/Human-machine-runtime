/**
 * 浏览器 URL hash 适配器 —— 前端唯一允许直接接触 window 的位置（infrastructure）。
 *
 * 分层依据（CLAUDE.md §1.1/§1.2）：application 层禁止 DOM 操作。store 通过本模块读写
 * URL hash，把 window.location 的副作用收敛在 infrastructure，保持依赖方向
 * application → infrastructure 合规。
 *
 * 所有操作带 SSR 防护：typeof window === 'undefined' 时安全 no-op / 返回空串。
 */

/** 读取当前 URL hash（去掉前导 #）。无 window 或无 hash 时返回空串。 */
export function readHash(): string {
  if (typeof window === 'undefined') return '';
  return window.location.hash.replace(/^#/, '');
}

/** 写入 URL hash。仅当目标值与当前不同时写入，避免与 hashchange 监听形成循环。 */
export function writeHash(value: string): void {
  if (typeof window === 'undefined') return;
  const target = `#${value}`;
  if (window.location.hash !== target) {
    window.location.hash = target;
  }
}

/**
 * 注册 hashchange 监听器，返回取消监听的函数。
 * 无 window 环境（SSR）时返回 no-op，调用方无需自行做环境判断。
 */
export function onHashChange(handler: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('hashchange', handler);
  return () => window.removeEventListener('hashchange', handler);
}
