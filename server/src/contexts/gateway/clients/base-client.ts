import { config } from '../../../config/index.js';
import { AppError } from '../../../shared/utils.js';

export interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  timeout?: number;
  authToken?: string;
  skipRetry?: boolean;
}

interface CircuitState {
  failures: number;
  state: 'closed' | 'open' | 'half-open';
  nextRetryAt: number;
}

export type TimeoutProfile = 'read' | 'write' | 'stream';

const TIMEOUT_PROFILES: Record<TimeoutProfile, () => number> = {
  read: () => config.gateway.readTimeoutMs,
  write: () => config.gateway.writeTimeoutMs,
  stream: () => config.gateway.workspaceBackendStreamTimeoutMs,
};

export interface GatewayRequestLog {
  service: string;
  method: string;
  path: string;
  status: number;
  durationMs: number;
  error?: string;
}

export type AuditSink = (log: GatewayRequestLog) => void;

let _auditSink: AuditSink | null = null;

export function setGatewayAuditSink(sink: AuditSink): void {
  _auditSink = sink;
}

export abstract class BaseGatewayClient {
  readonly serviceName: string;
  protected baseUrl: string;
  protected defaultHeaders: Record<string, string>;
  protected timeoutMs: number;
  protected retryCount: number;
  protected cbThreshold: number;
  private circuit: CircuitState = { failures: 0, state: 'closed', nextRetryAt: 0 };
  private _healthy = true;
  private _lastHealthCheck = 0;

  constructor(
    serviceName: string,
    baseUrl: string,
    options: { headers?: Record<string, string>; timeoutMs?: number } = {}
  ) {
    this.serviceName = serviceName;
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.defaultHeaders = { 'Content-Type': 'application/json', ...options.headers };
    this.timeoutMs = options.timeoutMs || config.gateway.timeoutMs;
    this.retryCount = config.gateway.retryCount;
    this.cbThreshold = config.gateway.circuitBreakerThreshold;
  }

  protected resolveTimeout(profile?: TimeoutProfile, explicit?: number): number {
    if (explicit) return explicit;
    if (profile) return TIMEOUT_PROFILES[profile]();
    return this.timeoutMs;
  }

  protected async request<T = unknown>(
    path: string,
    opts: RequestOptions & { timeoutProfile?: TimeoutProfile } = {}
  ): Promise<T> {
    this.checkCircuit();

    const url = `${this.baseUrl}${path}`;
    const method = opts.method || 'GET';
    const headers = { ...this.defaultHeaders, ...opts.headers };
    if (opts.authToken) {
      headers['Authorization'] = `Bearer ${opts.authToken}`;
    }
    // FormData 上传：移除默认 application/json，让 fetch 自动设置
    // multipart/form-data; boundary=...（否则文件会被 JSON.stringify 成 "{}" 损坏）
    const isFormData = typeof FormData !== 'undefined' && opts.body instanceof FormData;
    if (isFormData) {
      delete headers['Content-Type'];
    }

    const timeout = this.resolveTimeout(opts.timeoutProfile, opts.timeout);
    const maxAttempts = opts.skipRetry ? 1 : this.retryCount;
    let lastError: Error | null = null;
    const start = Date.now();

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (attempt > 0) {
        await this.backoff(attempt);
      }

      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);

        try {
          const res = await fetch(url, {
            method,
            headers,
            body: (isFormData ? opts.body : opts.body ? JSON.stringify(opts.body) : undefined) as
              | FormData
              | string
              | undefined,
            signal: controller.signal,
          });

          clearTimeout(timer);

          if (!res.ok) {
            const text = await res.text().catch(() => '');
            const err = new GatewayError(
              `${res.status} ${res.statusText}: ${text}`,
              res.status,
              url
            );

            this.emitAudit(method, path, res.status, Date.now() - start, text);

            if (res.status >= 400 && res.status < 500) {
              throw err;
            }
            lastError = err;
            this.recordFailure();
            continue;
          }

          this.recordSuccess();
          const body = (await res.json()) as T;
          this.emitAudit(method, path, res.status, Date.now() - start);
          return body;
        } finally {
          clearTimeout(timer);
        }
      } catch (err) {
        if (err instanceof GatewayError && err.status >= 400 && err.status < 500) {
          throw this.toAppError(err);
        }
        lastError = err instanceof Error ? err : new Error(String(err));
        this.recordFailure();
      }
    }

    this.emitAudit(method, path, 502, Date.now() - start, lastError?.message);
    throw new GatewayError(lastError?.message || 'Gateway request failed after retries', 502, url);
  }

  protected async requestRaw(
    path: string,
    opts: RequestOptions & { timeoutProfile?: TimeoutProfile } = {}
  ): Promise<Response> {
    this.checkCircuit();

    const url = `${this.baseUrl}${path}`;
    const method = opts.method || 'GET';
    const headers = { ...this.defaultHeaders, ...opts.headers };
    if (opts.authToken) {
      headers['Authorization'] = `Bearer ${opts.authToken}`;
    }
    const isFormData = typeof FormData !== 'undefined' && opts.body instanceof FormData;
    if (isFormData) {
      delete headers['Content-Type'];
    }

    const timeout = this.resolveTimeout(opts.timeoutProfile, opts.timeout);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const start = Date.now();

    try {
      const res = await fetch(url, {
        method,
        headers,
        body: (isFormData ? opts.body : opts.body ? JSON.stringify(opts.body) : undefined) as
          | FormData
          | string
          | undefined,
        signal: controller.signal,
      });
      this.recordSuccess();
      this.emitAudit(method, path, res.status, Date.now() - start);
      return res;
    } catch (err) {
      this.recordFailure();
      this.emitAudit(method, path, 502, Date.now() - start, String(err));
      throw err instanceof GatewayError
        ? err
        : new GatewayError(
            `Gateway request failed: ${err instanceof Error ? err.message : 'unknown'}`,
            502,
            url
          );
    } finally {
      clearTimeout(timer);
    }
  }

  isConfigured(): boolean {
    return Boolean(this.baseUrl);
  }

  getCircuitState(): string {
    return this.circuit.state;
  }

  isHealthy(): boolean {
    return this._healthy;
  }

  async checkHealth(path = '/healthz'): Promise<boolean> {
    const now = Date.now();
    if (now - this._lastHealthCheck < 30_000) return this._healthy;
    this._lastHealthCheck = now;

    if (!this.isConfigured()) {
      this._healthy = false;
      return false;
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3_000);
      try {
        const res = await fetch(`${this.baseUrl}${path}`, { signal: controller.signal });
        this._healthy = res.ok;
      } finally {
        clearTimeout(timer);
      }
    } catch {
      this._healthy = false;
    }
    return this._healthy;
  }

  private toAppError(err: GatewayError): AppError {
    return new AppError(
      `[${this.serviceName}] ${err.message}`,
      err.status,
      `GATEWAY_${this.serviceName.toUpperCase()}_ERROR`
    );
  }

  private emitAudit(
    method: string,
    path: string,
    status: number,
    durationMs: number,
    error?: string
  ): void {
    if (!_auditSink) return;
    try {
      _auditSink({ service: this.serviceName, method, path, status, durationMs, error });
    } catch {
      // never block on audit failures
    }
  }

  private checkCircuit(): void {
    if (this.circuit.state === 'open') {
      if (Date.now() >= this.circuit.nextRetryAt) {
        this.circuit.state = 'half-open';
      } else {
        throw new GatewayError('Circuit breaker open — upstream unavailable', 503, this.baseUrl);
      }
    }
  }

  private recordFailure(): void {
    this.circuit.failures++;
    if (this.circuit.failures >= this.cbThreshold) {
      this.circuit.state = 'open';
      this.circuit.nextRetryAt = Date.now() + 30_000;
    }
  }

  private recordSuccess(): void {
    this.circuit.failures = 0;
    this.circuit.state = 'closed';
  }

  private backoff(attempt: number): Promise<void> {
    const ms = Math.min(1000 * 2 ** attempt, 10_000);
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export class GatewayError extends Error {
  status: number;
  url: string;
  constructor(message: string, status: number, url: string) {
    super(message);
    this.status = status;
    this.url = url;
  }
}
