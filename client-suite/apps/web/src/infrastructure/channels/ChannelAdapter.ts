import type { ChannelType } from '../../domain/shared/types';
import type { NotificationProps } from '../../domain/notification/Notification';

/**
 * ChannelAdapter — pluggable adapter per IM platform.
 *
 * Each adapter handles:
 * 1. Inbound: listening for new messages and converting them to NotificationProps
 * 2. Outbound: sending replies back to the original channel/thread
 */
export interface ChannelAdapter {
  readonly channelType: ChannelType;
  readonly displayName: string;
  readonly isConnected: boolean;

  /** Start listening for inbound messages. Returns cleanup function. */
  startListening(onMessage: (props: NotificationProps) => void): () => void;

  /** Send a reply back to the original channel/thread. */
  sendReply(params: {
    externalId: string;
    roomId?: string;
    body: string;
  }): Promise<void>;

  /** Mark a message as read on the external platform. */
  markAsRead(externalId: string): Promise<void>;
}
