import type { ChannelType } from '../../domain/shared/types';
import type { ChannelAdapter } from './ChannelAdapter';
import type { ChannelConfigProps } from '../../domain/agent/ChannelConfig';
import { StubChannelAdapter } from './StubChannelAdapter';

/**
 * ChannelAdapterRegistry — manages all registered platform adapters.
 * Provides lookup by channel type and iteration over all adapters.
 * Supports dynamic rebuild from user-configured channels.
 */
class ChannelAdapterRegistryImpl {
  private adapters = new Map<ChannelType, ChannelAdapter>();

  register(adapter: ChannelAdapter): void {
    this.adapters.set(adapter.channelType, adapter);
  }

  get(channelType: ChannelType): ChannelAdapter | undefined {
    return this.adapters.get(channelType);
  }

  getAll(): ChannelAdapter[] {
    return Array.from(this.adapters.values());
  }

  rebuildFromConfig(configs: ChannelConfigProps[]): void {
    this.adapters.clear();
    for (const cfg of configs) {
      if (!cfg.enabled) continue;
      const channelType = cfg.type as ChannelType;
      this.adapters.set(channelType, new StubChannelAdapter(channelType, cfg.name));
    }
  }

  /** Initialize with stub adapters for default channels */
  static createDefault(): ChannelAdapterRegistryImpl {
    const registry = new ChannelAdapterRegistryImpl();
    const configs: Array<{ type: ChannelType; name: string }> = [
      { type: 'matrix', name: 'Matrix' },
      { type: 'wps', name: 'WPS' },
      { type: 'websocket', name: 'WebSocket' },
      { type: 'lark', name: 'Lark (飞书)' },
      { type: 'dingtalk', name: 'DingTalk (钉钉)' },
      { type: 'wecom', name: 'WeCom (企业微信)' },
      { type: 'email', name: 'Email' },
      { type: 'webhook', name: 'Webhook' },
    ];
    for (const cfg of configs) {
      registry.register(new StubChannelAdapter(cfg.type, cfg.name));
    }
    return registry;
  }
}

export const channelAdapterRegistry = ChannelAdapterRegistryImpl.createDefault();
