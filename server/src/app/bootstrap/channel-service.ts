/**
 * Channel 服务组装(消息通道适配器注册)。
 *
 * 从 `bootstrap.ts` 拆出:ChannelService + 3 个适配器(Matrix / Wps / WebSocket)。
 * 可选注入 InboundPipeline(runtime-engine 段构造的管线)。
 */
import { ChannelService } from '../../contexts/channel/channel-service.js';
import { MatrixChannelAdapter } from '../../contexts/channel/adapters/matrix-adapter.js';
import { WpsChannelAdapter } from '../../contexts/channel/adapters/wps-adapter.js';
import { WebSocketChannelAdapter } from '../../contexts/channel/adapters/websocket-adapter.js';
import type { ContainerOrchestratorClient } from '../../contexts/gateway/clients/container-orchestrator-client.js';
import type { InboundPipeline } from '../../contexts/channel/inbound-pipeline.js';

export function buildChannelService(
  containerOrchestratorClient: ContainerOrchestratorClient,
  pipeline?: InboundPipeline
): ChannelService {
  const channelService = new ChannelService();
  if (pipeline) channelService.setInboundPipeline(pipeline);
  channelService.registerAdapter(new MatrixChannelAdapter());
  channelService.registerAdapter(new WpsChannelAdapter(containerOrchestratorClient));
  channelService.registerAdapter(new WebSocketChannelAdapter());
  return channelService;
}
