import type {
  ContainerOrchestratorWsBridge,
  WsBridgeMessage,
} from '../gateway/clients/container-orchestrator-ws-bridge.js';
import type { ChannelType, InboundMessage } from './channel-adapter.js';
import type { InboundPipeline } from './inbound-pipeline.js';
import { logger } from '../../app/logger.js';

export interface BridgeSession {
  userId: string;
  instanceId: string;
  connectionKey: string;
  channels: ChannelType[];
  createdAt: number;
}

export class ChannelBridgeService {
  private sessions = new Map<string, BridgeSession>();

  constructor(
    private wsBridge: ContainerOrchestratorWsBridge,
    private inboundPipeline: InboundPipeline
  ) {
    this.wsBridge.on('message', (_key: string, msg: WsBridgeMessage) => {
      this.onUpstreamMessage(_key, msg);
    });

    this.wsBridge.on('upstream:close', (key: string) => {
      this.sessions.delete(key);
    });
  }

  async openSession(
    userId: string,
    instanceId: string,
    channels: ChannelType[],
    authToken?: string
  ): Promise<BridgeSession> {
    const connectionKey = await this.wsBridge.connect(userId, instanceId, authToken);
    const session: BridgeSession = {
      userId,
      instanceId,
      connectionKey,
      channels,
      createdAt: Date.now(),
    };
    this.sessions.set(connectionKey, session);
    return session;
  }

  closeSession(userId: string, instanceId: string): void {
    this.wsBridge.disconnect(userId, instanceId);
    const key = `${userId}:${instanceId}`;
    this.sessions.delete(key);
  }

  sendToUpstream(connectionKey: string, message: WsBridgeMessage): boolean {
    return this.wsBridge.send(connectionKey, message);
  }

  getSession(userId: string, instanceId: string): BridgeSession | undefined {
    return this.sessions.get(`${userId}:${instanceId}`);
  }

  get activeSessionCount(): number {
    return this.sessions.size;
  }

  private onUpstreamMessage(connectionKey: string, msg: WsBridgeMessage): void {
    const session = this.sessions.get(connectionKey);
    if (!session) return;

    const inbound: InboundMessage = {
      id: crypto.randomUUID(),
      channelType: 'websocket',
      sender: { id: session.userId, channel: 'websocket' },
      roomId: session.instanceId,
      content: msg.content ?? '',
      contentType: msg.type === 'text' ? 'text' : 'rich_text',
      rawPayload: msg,
      receivedAt: new Date(),
    };

    this.inboundPipeline.process(inbound).catch((err) => {
      logger.warn({ connectionKey, err: String(err) }, 'inbound pipeline error');
    });
  }
}
