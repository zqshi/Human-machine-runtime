/**
 * Session handler — infrastructure 层处理 401 的回调注入点。
 * application 层启动时调用 setOnSessionExpired 注入具体逻辑，
 * 避免 infrastructure 反向引用 application/stores。
 */

let onSessionExpired: (() => void) | null = null;

export function setOnSessionExpired(handler: () => void): void {
  onSessionExpired = handler;
}

export function handleSessionExpired(): void {
  onSessionExpired?.();
}
