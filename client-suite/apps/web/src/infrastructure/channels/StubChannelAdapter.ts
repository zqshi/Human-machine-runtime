import type { ChannelAdapter } from './ChannelAdapter';
import type { ChannelType } from '../../domain/shared/types';
import type { NotificationProps } from '../../domain/notification/Notification';

export class StubChannelAdapter implements ChannelAdapter {
  constructor(
    public readonly channelType: ChannelType,
    public readonly displayName: string
  ) {}

  get isConnected(): boolean {
    return true;
  }

  startListening(_onMessage: (props: NotificationProps) => void): () => void {
    return () => {};
  }

  async sendReply(_params: { externalId: string; roomId?: string; body: string }): Promise<void> {}

  async markAsRead(_externalId: string): Promise<void> {}
}
