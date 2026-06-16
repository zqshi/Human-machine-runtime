import { EventEmitter } from 'node:events';

export type SSEEvent = {
  type: string;
  data: Record<string, unknown>;
  tenantId?: string;
  userId?: string;
};

class AppEventBus extends EventEmitter {
  emit(event: 'sse', payload: SSEEvent): boolean;
  emit(event: string, ...args: unknown[]): boolean {
    return super.emit(event, ...args);
  }

  onSSE(handler: (payload: SSEEvent) => void): void {
    this.on('sse', handler);
  }

  offSSE(handler: (payload: SSEEvent) => void): void {
    this.off('sse', handler);
  }

  publish(
    type: string,
    data: Record<string, unknown>,
    meta?: { tenantId?: string; userId?: string }
  ): void {
    this.emit('sse', { type, data, tenantId: meta?.tenantId, userId: meta?.userId });
  }
}

export const appEventBus = new AppEventBus();
appEventBus.setMaxListeners(200);
