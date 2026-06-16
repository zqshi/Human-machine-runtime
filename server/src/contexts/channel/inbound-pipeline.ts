import type { InboundMessage } from './channel-adapter.js';
import { logger } from '../../app/logger.js';

export type InboundHandler = (msg: InboundMessage) => Promise<void>;

export class InboundPipeline {
  private handlers: InboundHandler[] = [];

  use(handler: InboundHandler): void {
    this.handlers.push(handler);
  }

  async process(msg: InboundMessage): Promise<void> {
    for (const handler of this.handlers) {
      try {
        await handler(msg);
      } catch (err) {
        logger.error(
          { channelType: msg.channelType, msgId: msg.id, err: String(err) },
          'inbound handler error'
        );
      }
    }
  }
}
