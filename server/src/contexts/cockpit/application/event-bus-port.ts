/** 事件总线端口（appEventBus 实现，service 注入便于单测 mock）。 */
export interface EventBusPort {
  publish(event: string, payload: unknown): void;
}
