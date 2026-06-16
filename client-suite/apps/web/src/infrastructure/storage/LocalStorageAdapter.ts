/**
 * LocalStorage adapter with safe JSON parse
 */
export class LocalStorageAdapter {
  static get<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  }

  static set(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // quota exceeded — ignore
    }
  }

  static remove(key: string): void {
    localStorage.removeItem(key);
  }
}
