export function navigateTo(url: string): void {
  window.location.href = url;
}

export function getCurrentOrigin(): string {
  return window.location.origin;
}
