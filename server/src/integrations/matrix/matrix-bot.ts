import type {
  IInstanceService,
  IRuntimeProxyService,
  IDocumentService,
  IWeKnoraService,
  IAuditService,
  InstanceRow,
  MatrixCard,
  EmployeeProfile,
  StatusInput,
  BotResult,
  DrawerContent,
  MatrixBotConfig,
  MatrixBotDeps,
  Logger,
  InvokeResult,
  BotContext,
} from './matrix-bot-types.js';

import {
  handleCreateAgent,
  handleListAgents,
  handleAgentStatus,
  handleJobStatus,
  handleStartAgent,
  handleStopAgent,
  handleCreateDoc,
  handleShareDoc,
  handleAsk,
  handleSearchKb,
} from './matrix-bot-commands.js';

import {
  tryHandleNaturalCreateIntent,
  tryHandleNaturalRagIntent,
  isNaturalCreateIntent,
  isNaturalRagIntent,
  extractEmployeeName,
  defaultEmployeeName,
  inferJobTitle,
  buildCreatorProfile,
} from './matrix-bot-nlu.js';

export type {
  IInstanceService,
  IRuntimeProxyService,
  IDocumentService,
  IWeKnoraService,
  IAuditService,
  InstanceRow,
  MatrixCard,
  EmployeeProfile,
  StatusInput,
  BotResult,
  DrawerContent,
  MatrixBotConfig,
  MatrixBotDeps,
  Logger,
  InvokeResult,
};

export class MatrixBot {
  private config: MatrixBotConfig;
  private logger: Logger;
  private instanceService: IInstanceService;
  private runtimeProxyService: IRuntimeProxyService | null;
  private resolveIdentityProfile:
    | ((sender: string) => Promise<Partial<EmployeeProfile> | null>)
    | null;
  private auditService: IAuditService | null;
  private documentService: IDocumentService | null;
  private weKnoraService: IWeKnoraService | null;
  private _ragCooldowns = new Map<string, number>();
  readonly simulation: boolean;

  constructor(
    config: MatrixBotConfig,
    logger: Logger,
    instanceService: IInstanceService,
    deps: MatrixBotDeps = {}
  ) {
    this.config = config;
    this.logger = logger;
    this.instanceService = instanceService;
    this.runtimeProxyService = deps.runtimeProxyService || null;
    this.resolveIdentityProfile = deps.resolveIdentityProfile || null;
    this.auditService = deps.auditService || null;
    this.documentService = deps.documentService || null;
    this.weKnoraService = deps.weKnoraService || null;
    this.simulation = !String(config.matrixAccessToken || '').trim();
  }

  private async audit(type: string, payload: Record<string, unknown> = {}) {
    if (!this.auditService) return;
    await this.auditService.log(type, payload);
  }

  private getContext(): BotContext {
    return {
      instanceService: this.instanceService,
      runtimeProxyService: this.runtimeProxyService,
      documentService: this.documentService,
      weKnoraService: this.weKnoraService,
      auditService: this.auditService,
      logger: this.logger,
      ragCooldowns: this._ragCooldowns,
      renderStatusMessage: (input) => this.renderStatusMessage(input),
      renderCardMessage: (card, traceId) => this.renderCardMessage(card, traceId),
      audit: (type, payload) => this.audit(type, payload),
      buildProvisionRequestId: (params) => this.buildProvisionRequestId(params),
      buildCreatorProfile: (sender, intent) => this.buildCreatorProfile(sender, intent),
    };
  }

  renderStatusMessage(input: Partial<StatusInput> = {}): string {
    const action = String(input.action || 'unknown');
    const phase = String(input.phase || 'unknown');
    const lines = ['【任务状态】', `- action: ${action}`, `- phase: ${phase}`];
    if (input.traceId) lines.push(`- traceId: ${input.traceId}`);
    if (input.requestId) lines.push(`- requestId: ${input.requestId}`);
    if (input.message) lines.push(`- message: ${input.message}`);
    if (input.instanceId) lines.push(`- instanceId: ${input.instanceId}`);
    if (input.roomId) lines.push(`- roomId: ${input.roomId}`);
    if (input.chatUrl) lines.push(`- chatUrl: ${input.chatUrl}`);
    return lines.join('\n');
  }

  private renderCardMessage(card: MatrixCard, traceId: string): string {
    const actions = card.actions || [];
    const openChat = actions.find((x) => x.type === 'open_chat');
    return this.renderStatusMessage({
      action: 'create_agent',
      phase: 'succeeded',
      traceId,
      message: '数字员工实例创建完成，可直接进入会话。',
      instanceId: card.instanceId,
      roomId: card.matrixRoomId,
      chatUrl: openChat?.url || card.chatUrl || '',
    });
  }

  async start() {
    this.logger.info('matrix bot started', {
      simulation: this.simulation,
      userId: this.config.matrixUserId,
    });
    await this.audit('matrix.bot.started', {
      simulation: this.simulation,
      userId: this.config.matrixUserId,
    });
  }

  async stop() {
    this.logger.info('matrix bot stopped');
    await this.audit('matrix.bot.stopped', {
      simulation: this.simulation,
      userId: this.config.matrixUserId,
    });
  }

  async processTextMessage(
    sender: string,
    roomId: string,
    text: string,
    meta: { eventId?: string } = {}
  ): Promise<BotResult> {
    const body = String(text || '').trim();
    if (!body) return { ignored: true };

    const isCommand = body.startsWith('!');
    const tokens = body.split(/\s+/);
    const cmd = isCommand ? tokens[0].toLowerCase() : '';
    const traceId = `mx:cmd:${roomId}:${sender}:${Date.now()}`;
    const ctx = this.getContext();

    if (!isCommand) {
      const passthrough = await this.processChannelMessage(sender, roomId, body, traceId);
      if (passthrough) return passthrough;
      const ragResult = await tryHandleNaturalRagIntent(ctx, sender, roomId, body, traceId);
      if (ragResult) return ragResult;
      const created = await tryHandleNaturalCreateIntent(ctx, sender, roomId, body, traceId, meta);
      if (created) return created;
      return { ignored: true };
    }

    await this.audit('matrix.command.received', {
      traceId,
      sender,
      roomId,
      command: cmd,
      text: body,
    });

    if (cmd === '!create_agent')
      return handleCreateAgent(ctx, tokens, sender, roomId, traceId, meta);
    if (cmd === '!list_agents') return handleListAgents(ctx, roomId, traceId);
    if (cmd === '!agent_status') return handleAgentStatus(ctx, tokens, roomId, traceId);
    if (cmd === '!job_status') return handleJobStatus(ctx, tokens, roomId, traceId);
    if (cmd === '!start_agent') return handleStartAgent(ctx, tokens, roomId, traceId);
    if (cmd === '!stop_agent') return handleStopAgent(ctx, tokens, roomId, traceId);
    if (cmd === '!create_doc') return handleCreateDoc(ctx, tokens, sender, roomId, traceId);
    if (cmd === '!share_doc') return handleShareDoc(ctx, tokens, roomId, traceId);
    if (cmd === '!ask') return handleAsk(ctx, tokens, sender, roomId, traceId);
    if (cmd === '!search_kb') return handleSearchKb(ctx, tokens, roomId, traceId);

    const reply = this.renderStatusMessage({
      action: cmd.replace(/^!/, ''),
      phase: 'failed',
      traceId,
      roomId,
      message:
        '未知命令。可用命令: !create_agent !list_agents !agent_status !job_status !start_agent !stop_agent !create_doc !share_doc !ask !search_kb',
    });
    await this.audit('matrix.command.handled', {
      traceId,
      command: cmd,
      phase: 'failed',
      roomId,
      reason: 'unknown_command',
    });
    return { ignored: false, reply, phase: 'failed', traceId };
  }

  private async resolveInstanceByRoomId(roomId: string): Promise<InstanceRow | null> {
    const key = roomId.trim();
    if (!key) return null;
    const rows = await this.instanceService.list();
    const matched = rows.filter((x) => (x.matrixRoomId || '').trim() === key);
    if (!matched.length) return null;
    return matched.find((x) => x.state.toLowerCase() === 'running') || matched[0];
  }

  private async processChannelMessage(
    sender: string,
    roomId: string,
    body: string,
    traceId: string
  ): Promise<BotResult | null> {
    const instance = await this.resolveInstanceByRoomId(roomId);
    if (!instance) return null;
    const mode = this.resolveConversationMode();
    if (mode === 'cockpit_channel') {
      await this.audit('matrix.channel.delegated', {
        traceId,
        roomId,
        sender,
        instanceId: instance.id,
        mode,
      });
      return { ignored: true, delegated: true, phase: 'delegated', traceId };
    }
    if (!this.runtimeProxyService) {
      return {
        ignored: false,
        phase: 'failed',
        traceId,
        reply: 'runtime proxy 未启用，当前无法转发到数字员工实例。',
      };
    }
    try {
      const invokeOut = await this.runtimeProxyService.invoke(instance.id, {
        input: body,
        source: 'matrix',
        sender,
        roomId,
        channel: 'matrix',
      });
      const reply = this.extractAssistantText(invokeOut) || this.summarizeInvokeResult(invokeOut);
      await this.audit('matrix.channel.passthrough.succeeded', {
        traceId,
        roomId,
        sender,
        instanceId: instance.id,
        mode: invokeOut.mode || '',
      });
      const drawerContent = this.detectDrawerContent(reply);
      return { ignored: false, phase: 'succeeded', traceId, reply, data: invokeOut, drawerContent };
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'runtime invoke failed';
      await this.audit('matrix.channel.passthrough.failed', {
        traceId,
        roomId,
        sender,
        instanceId: instance.id,
        reason,
      });
      return {
        ignored: false,
        phase: 'failed',
        traceId,
        reply: `执行失败：${reason}。请稍后重试或联系管理员。`,
      };
    }
  }

  private resolveConversationMode(): string {
    const raw = String(this.config.matrixConversationMode || '')
      .trim()
      .toLowerCase();
    if (raw === 'runtime_proxy') return 'runtime_proxy';
    return 'cockpit_channel';
  }

  buildProvisionRequestId(params: {
    roomId?: string;
    sender?: string;
    name?: string;
    eventId?: string;
  }): string {
    const e = (params.eventId || '').trim();
    if (e) return `mx:event:${e}`;
    const seed = `${(params.roomId || '').trim()}|${(params.sender || '').trim()}|${(params.name || '').trim()}|${Date.now()}`;
    return `mx:create:${this.hashText(seed)}`;
  }

  private hashText(text: string): string {
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }

  isNaturalCreateIntent(text: string): boolean {
    return isNaturalCreateIntent(text);
  }

  isNaturalRagIntent(text: string): boolean {
    return isNaturalRagIntent(text);
  }

  extractEmployeeName(text: string): string {
    return extractEmployeeName(text);
  }

  defaultEmployeeName(text: string): string {
    return defaultEmployeeName(text);
  }

  inferJobTitle(text: string): string {
    return inferJobTitle(text);
  }

  async buildCreatorProfile(
    sender: string,
    intent: { jobTitle?: string } = {}
  ): Promise<EmployeeProfile> {
    return buildCreatorProfile(this.resolveIdentityProfile, sender, intent);
  }

  private detectDrawerContent(reply: string): DrawerContent | undefined {
    if (!reply) return undefined;
    const codeBlockMatch = reply.match(/```(\w*)\n([\s\S]*?)```/);
    if (codeBlockMatch) {
      const language = codeBlockMatch[1] || 'plaintext';
      const code = codeBlockMatch[2].trim();
      return { type: 'code', title: `代码片段 (${language})`, data: { code, language } };
    }
    return undefined;
  }

  private extractAssistantText(invokeOut: InvokeResult): string {
    const response = invokeOut.response || {};
    const candidates = [
      response.output,
      response.text,
      response.message,
      response.result,
      response.summary,
    ];
    for (const item of candidates) {
      const text = String(item || '').trim();
      if (text) return text;
    }
    return '';
  }

  private summarizeInvokeResult(invokeOut: InvokeResult): string {
    if ((invokeOut.mode || '').toLowerCase() === 'degraded') {
      return '当前处于降级模式，任务已受理但可能延迟执行。';
    }
    const payload = invokeOut.response || {};
    const candidates = [payload.output, payload.message, payload.result, payload.summary];
    for (const item of candidates) {
      const text = String(item || '').trim();
      if (!text) continue;
      return text.length > 120 ? `执行摘要: ${text.slice(0, 120)}...` : `执行摘要: ${text}`;
    }
    return '任务已进入执行链路。';
  }
}
