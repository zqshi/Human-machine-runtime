import type { BaseGatewayClient } from './clients/base-client.js';

export interface GatewayStatus {
  name: string;
  configured: boolean;
  healthy: boolean;
  circuit: string;
}

export class GatewayHealth {
  private clients: BaseGatewayClient[];
  private checkIntervalMs: number;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(clients: BaseGatewayClient[], checkIntervalMs = 60_000) {
    this.clients = clients;
    this.checkIntervalMs = checkIntervalMs;
  }

  start(): void {
    if (this.timer) return;
    this.checkAll();
    this.timer = setInterval(() => this.checkAll(), this.checkIntervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async checkAll(): Promise<void> {
    await Promise.allSettled(this.clients.map((c) => c.checkHealth()));
  }

  getStatus(): GatewayStatus[] {
    return this.clients.map((c) => ({
      name: c.serviceName,
      configured: c.isConfigured(),
      healthy: c.isHealthy(),
      circuit: c.getCircuitState(),
    }));
  }

  hasAnyHealthy(): boolean {
    return this.clients.some((c) => c.isConfigured() && c.isHealthy());
  }

  hasAllConfiguredHealthy(): boolean {
    const configured = this.clients.filter((c) => c.isConfigured());
    if (configured.length === 0) return true;
    return configured.every((c) => c.isHealthy());
  }
}
