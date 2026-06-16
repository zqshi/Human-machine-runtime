import type { ChannelType, ChannelMessage } from '../channel/channel-adapter.js';
import type { ChannelService } from '../channel/channel-service.js';
import { logger } from '../../app/logger.js';

export type ReceiptStatus = 'pending' | 'sent' | 'delivered' | 'failed';

export interface ExecutionReceipt {
  id: string;
  taskId: string;
  tenantId: string;
  originChannel: ChannelType;
  originRoomId: string;
  originUserId: string;
  summary: string;
  detail?: string;
  status: ReceiptStatus;
  createdAt: Date;
  sentAt?: Date;
  error?: string;
}

export interface ReceiptTemplate {
  success: (taskName: string, summary: string) => ChannelMessage;
  failure: (taskName: string, error: string) => ChannelMessage;
  progress: (taskName: string, progress: number) => ChannelMessage;
}

const DEFAULT_TEMPLATES: ReceiptTemplate = {
  success: (taskName, summary) => ({
    type: 'rich_text',
    content: `✅ **${taskName}** 执行完成\n\n${summary}`,
  }),
  failure: (taskName, error) => ({
    type: 'rich_text',
    content: `❌ **${taskName}** 执行失败\n\n原因: ${error}`,
  }),
  progress: (taskName, progress) => ({
    type: 'text',
    content: `⏳ ${taskName} 执行中 (${progress}%)`,
  }),
};

export class ReceiptManager {
  private receipts = new Map<string, ExecutionReceipt>();
  private channelService: ChannelService;
  private templates: ReceiptTemplate;

  constructor(channelService: ChannelService, templates?: Partial<ReceiptTemplate>) {
    this.channelService = channelService;
    this.templates = { ...DEFAULT_TEMPLATES, ...templates };
  }

  createReceipt(params: Omit<ExecutionReceipt, 'status' | 'createdAt'>): ExecutionReceipt {
    const receipt: ExecutionReceipt = {
      ...params,
      status: 'pending',
      createdAt: new Date(),
    };
    this.receipts.set(receipt.id, receipt);
    return receipt;
  }

  async sendSuccessReceipt(receiptId: string, taskName: string, summary: string): Promise<void> {
    const receipt = this.receipts.get(receiptId);
    if (!receipt) return;

    const message = this.templates.success(taskName, summary);
    await this.deliver(receipt, message);
  }

  async sendFailureReceipt(receiptId: string, taskName: string, error: string): Promise<void> {
    const receipt = this.receipts.get(receiptId);
    if (!receipt) return;

    const message = this.templates.failure(taskName, error);
    await this.deliver(receipt, message);
  }

  async sendProgressReceipt(receiptId: string, taskName: string, progress: number): Promise<void> {
    const receipt = this.receipts.get(receiptId);
    if (!receipt) return;

    const message = this.templates.progress(taskName, progress);
    try {
      await this.channelService.sendToChannel(
        { channelType: receipt.originChannel, roomId: receipt.originRoomId },
        message
      );
    } catch (err) {
      logger.warn({ receiptId, err: String(err) }, 'progress receipt delivery failed');
    }
  }

  getReceipt(receiptId: string): ExecutionReceipt | undefined {
    return this.receipts.get(receiptId);
  }

  listPendingReceipts(): ExecutionReceipt[] {
    return Array.from(this.receipts.values()).filter((r) => r.status === 'pending');
  }

  async retryFailed(): Promise<number> {
    const failed = Array.from(this.receipts.values()).filter((r) => r.status === 'failed');
    let retried = 0;

    for (const receipt of failed) {
      try {
        const message: ChannelMessage = {
          type: 'text',
          content: receipt.summary,
        };
        await this.deliver(receipt, message);
        retried++;
      } catch {
        // still failed, leave status
      }
    }

    return retried;
  }

  private async deliver(receipt: ExecutionReceipt, message: ChannelMessage): Promise<void> {
    try {
      await this.channelService.sendToChannel(
        { channelType: receipt.originChannel, roomId: receipt.originRoomId },
        message
      );
      receipt.status = 'sent';
      receipt.sentAt = new Date();
    } catch (err) {
      receipt.status = 'failed';
      receipt.error = err instanceof Error ? err.message : String(err);
      logger.error({ receiptId: receipt.id, err: receipt.error }, 'receipt delivery failed');
      throw err;
    }
  }
}
