import type { BotContext, BotResult } from './matrix-bot-types.js';

export async function handleCreateAgent(
  ctx: BotContext,
  tokens: string[],
  sender: string,
  roomId: string,
  traceId: string,
  meta: { eventId?: string }
): Promise<BotResult> {
  const name = tokens.slice(1).join(' ').trim();
  if (!name) {
    const reply = ctx.renderStatusMessage({
      action: 'create_agent',
      phase: 'failed',
      traceId,
      roomId,
      message: '用法: !create_agent <员工名称>',
    });
    await ctx.audit('matrix.command.handled', {
      traceId,
      command: '!create_agent',
      phase: 'failed',
      reason: 'invalid_args',
    });
    return { ignored: false, reply, phase: 'failed', traceId };
  }
  const requestId = ctx.buildProvisionRequestId({ roomId, sender, name, eventId: meta.eventId });
  try {
    const creatorProfile = await ctx.buildCreatorProfile(sender, {});
    const instance = await ctx.instanceService.createFromMatrix({
      name,
      creator: sender,
      matrixRoomId: roomId,
      requestId,
      employeeProfile: creatorProfile,
    });
    const card = ctx.instanceService.buildMatrixCard(instance);
    const reply = `${ctx.renderCardMessage(card, traceId)}\n- requestId: ${requestId}`;
    await ctx.audit('matrix.command.handled', {
      traceId,
      command: '!create_agent',
      phase: 'succeeded',
      instanceId: instance.id,
      roomId,
    });
    return { ignored: false, reply, card, phase: 'succeeded', traceId };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'create failed';
    const reply = ctx.renderStatusMessage({
      action: 'create_agent',
      phase: 'failed',
      traceId,
      roomId,
      message: reason,
    });
    await ctx.audit('matrix.command.handled', {
      traceId,
      command: '!create_agent',
      phase: 'failed',
      roomId,
      reason,
    });
    return { ignored: false, reply, phase: 'failed', traceId };
  }
}

export async function handleListAgents(
  ctx: BotContext,
  roomId: string,
  traceId: string
): Promise<BotResult> {
  const rows = await ctx.instanceService.list();
  const lines = rows.map((x) => `- ${x.name} | ${x.id} | ${x.state}`);
  await ctx.audit('matrix.command.handled', {
    traceId,
    command: '!list_agents',
    phase: 'succeeded',
    rows: rows.length,
    roomId,
  });
  return {
    ignored: false,
    reply:
      ctx.renderStatusMessage({
        action: 'list_agents',
        phase: 'succeeded',
        traceId,
        roomId,
        message: lines.length ? `共 ${rows.length} 个数字员工` : '暂无数字员工',
      }) + (lines.length ? `\n${lines.join('\n')}` : ''),
    phase: 'succeeded',
    traceId,
  };
}

export async function handleAgentStatus(
  ctx: BotContext,
  tokens: string[],
  roomId: string,
  traceId: string
): Promise<BotResult> {
  const id = (tokens[1] || '').trim();
  if (!id) {
    const reply = ctx.renderStatusMessage({
      action: 'agent_status',
      phase: 'failed',
      traceId,
      roomId,
      message: '用法: !agent_status <instanceId>',
    });
    await ctx.audit('matrix.command.handled', {
      traceId,
      command: '!agent_status',
      phase: 'failed',
      reason: 'invalid_args',
    });
    return { ignored: false, reply, phase: 'failed', traceId };
  }
  const row = await ctx.instanceService.get(id);
  await ctx.audit('matrix.command.handled', {
    traceId,
    command: '!agent_status',
    phase: 'succeeded',
    instanceId: row.id,
    roomId,
  });
  return {
    ignored: false,
    reply: ctx.renderStatusMessage({
      action: 'agent_status',
      phase: 'succeeded',
      traceId,
      roomId,
      message: `${row.name} | ${row.id} | ${row.state} | ${row.runtime.endpoint || '-'}`,
    }),
    phase: 'succeeded',
    traceId,
  };
}

export async function handleJobStatus(
  ctx: BotContext,
  tokens: string[],
  roomId: string,
  traceId: string
): Promise<BotResult> {
  const requestId = (tokens[1] || '').trim();
  if (!requestId) {
    const reply = ctx.renderStatusMessage({
      action: 'job_status',
      phase: 'failed',
      traceId,
      roomId,
      message: '用法: !job_status <requestId>',
    });
    await ctx.audit('matrix.command.handled', {
      traceId,
      command: '!job_status',
      phase: 'failed',
      reason: 'invalid_args',
    });
    return { ignored: false, reply, phase: 'failed', traceId };
  }
  if (!ctx.instanceService.getProvisioningJob) {
    const reply = ctx.renderStatusMessage({
      action: 'job_status',
      phase: 'failed',
      traceId,
      roomId,
      requestId,
      message: '当前服务未启用任务状态查询。',
    });
    await ctx.audit('matrix.command.handled', {
      traceId,
      command: '!job_status',
      phase: 'failed',
      reason: 'service_unavailable',
    });
    return { ignored: false, reply, phase: 'failed', traceId };
  }
  try {
    const job = await ctx.instanceService.getProvisioningJob(requestId);
    const reply = ctx.renderStatusMessage({
      action: 'job_status',
      phase: String(job.status || job.phase || 'unknown'),
      traceId,
      roomId,
      requestId,
      instanceId: job.instanceId || '',
      message: `phase=${job.phase || 'unknown'} attempts=${job.attempts || 0}${job.error ? ` error=${job.error}` : ''}`,
    });
    await ctx.audit('matrix.command.handled', {
      traceId,
      command: '!job_status',
      phase: 'succeeded',
      requestId,
      roomId,
    });
    return { ignored: false, reply, phase: 'succeeded', traceId };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'job lookup failed';
    const reply = ctx.renderStatusMessage({
      action: 'job_status',
      phase: 'failed',
      traceId,
      roomId,
      requestId,
      message: reason,
    });
    await ctx.audit('matrix.command.handled', {
      traceId,
      command: '!job_status',
      phase: 'failed',
      reason,
      requestId,
      roomId,
    });
    return { ignored: false, reply, phase: 'failed', traceId };
  }
}

export async function handleStartAgent(
  ctx: BotContext,
  tokens: string[],
  roomId: string,
  traceId: string
): Promise<BotResult> {
  const id = (tokens[1] || '').trim();
  if (!id) {
    const reply = ctx.renderStatusMessage({
      action: 'start_agent',
      phase: 'failed',
      traceId,
      roomId,
      message: '用法: !start_agent <instanceId>',
    });
    await ctx.audit('matrix.command.handled', {
      traceId,
      command: '!start_agent',
      phase: 'failed',
      reason: 'invalid_args',
    });
    return { ignored: false, reply, phase: 'failed', traceId };
  }
  const row = await ctx.instanceService.start(id);
  await ctx.audit('matrix.command.handled', {
    traceId,
    command: '!start_agent',
    phase: 'succeeded',
    instanceId: row.id,
    roomId,
  });
  return {
    ignored: false,
    reply: ctx.renderStatusMessage({
      action: 'start_agent',
      phase: 'succeeded',
      traceId,
      roomId,
      instanceId: row.id,
      message: `已启动 (${row.state})`,
    }),
    phase: 'succeeded',
    traceId,
  };
}

export async function handleStopAgent(
  ctx: BotContext,
  tokens: string[],
  roomId: string,
  traceId: string
): Promise<BotResult> {
  const id = (tokens[1] || '').trim();
  if (!id) {
    const reply = ctx.renderStatusMessage({
      action: 'stop_agent',
      phase: 'failed',
      traceId,
      roomId,
      message: '用法: !stop_agent <instanceId>',
    });
    await ctx.audit('matrix.command.handled', {
      traceId,
      command: '!stop_agent',
      phase: 'failed',
      reason: 'invalid_args',
    });
    return { ignored: false, reply, phase: 'failed', traceId };
  }
  const row = await ctx.instanceService.stop(id);
  await ctx.audit('matrix.command.handled', {
    traceId,
    command: '!stop_agent',
    phase: 'succeeded',
    instanceId: row.id,
    roomId,
  });
  return {
    ignored: false,
    reply: ctx.renderStatusMessage({
      action: 'stop_agent',
      phase: 'succeeded',
      traceId,
      roomId,
      instanceId: row.id,
      message: `已停止 (${row.state})`,
    }),
    phase: 'succeeded',
    traceId,
  };
}

export async function handleCreateDoc(
  ctx: BotContext,
  tokens: string[],
  sender: string,
  roomId: string,
  traceId: string
): Promise<BotResult> {
  const title = tokens.slice(1).join(' ').trim();
  if (!title) {
    const reply = ctx.renderStatusMessage({
      action: 'create_doc',
      phase: 'failed',
      traceId,
      roomId,
      message: '用法: !create_doc <标题>',
    });
    await ctx.audit('matrix.command.handled', {
      traceId,
      command: '!create_doc',
      phase: 'failed',
      reason: 'invalid_args',
    });
    return { ignored: false, reply, phase: 'failed', traceId };
  }
  if (!ctx.documentService) {
    const reply = ctx.renderStatusMessage({
      action: 'create_doc',
      phase: 'failed',
      traceId,
      roomId,
      message: '文档服务未启用',
    });
    await ctx.audit('matrix.command.handled', {
      traceId,
      command: '!create_doc',
      phase: 'failed',
      reason: 'service_unavailable',
    });
    return { ignored: false, reply, phase: 'failed', traceId };
  }
  try {
    const doc = await ctx.documentService.create({
      title,
      roomId,
      type: 'doc',
      createdBy: sender,
      content: { html: '' },
    });
    const reply = ctx.renderStatusMessage({
      action: 'create_doc',
      phase: 'succeeded',
      traceId,
      roomId,
      message: `文档「${doc.title}」已创建 (id: ${doc.id})`,
    });
    await ctx.audit('matrix.command.handled', {
      traceId,
      command: '!create_doc',
      phase: 'succeeded',
      documentId: doc.id,
      roomId,
    });
    return {
      ignored: false,
      reply,
      phase: 'succeeded',
      traceId,
      drawerContent: { type: 'doc', title: doc.title, data: { docId: doc.id, html: '' } },
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'create_doc failed';
    const reply = ctx.renderStatusMessage({
      action: 'create_doc',
      phase: 'failed',
      traceId,
      roomId,
      message: reason,
    });
    await ctx.audit('matrix.command.handled', {
      traceId,
      command: '!create_doc',
      phase: 'failed',
      reason,
      roomId,
    });
    return { ignored: false, reply, phase: 'failed', traceId };
  }
}

export async function handleShareDoc(
  ctx: BotContext,
  tokens: string[],
  roomId: string,
  traceId: string
): Promise<BotResult> {
  const docId = (tokens[1] || '').trim();
  if (!docId) {
    const reply = ctx.renderStatusMessage({
      action: 'share_doc',
      phase: 'failed',
      traceId,
      roomId,
      message: '用法: !share_doc <docId>',
    });
    await ctx.audit('matrix.command.handled', {
      traceId,
      command: '!share_doc',
      phase: 'failed',
      reason: 'invalid_args',
    });
    return { ignored: false, reply, phase: 'failed', traceId };
  }
  if (!ctx.documentService) {
    const reply = ctx.renderStatusMessage({
      action: 'share_doc',
      phase: 'failed',
      traceId,
      roomId,
      message: '文档服务未启用',
    });
    await ctx.audit('matrix.command.handled', {
      traceId,
      command: '!share_doc',
      phase: 'failed',
      reason: 'service_unavailable',
    });
    return { ignored: false, reply, phase: 'failed', traceId };
  }
  try {
    const doc = await ctx.documentService.get(docId);
    const reply = ctx.renderStatusMessage({
      action: 'share_doc',
      phase: 'succeeded',
      traceId,
      roomId,
      message: `分享文档「${doc.title}」(id: ${doc.id})`,
    });
    await ctx.audit('matrix.command.handled', {
      traceId,
      command: '!share_doc',
      phase: 'succeeded',
      documentId: doc.id,
      roomId,
    });
    return {
      ignored: false,
      reply,
      phase: 'succeeded',
      traceId,
      drawerContent: { type: doc.type, title: doc.title, data: { docId: doc.id, ...doc.content } },
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'share_doc failed';
    const reply = ctx.renderStatusMessage({
      action: 'share_doc',
      phase: 'failed',
      traceId,
      roomId,
      message: reason,
    });
    await ctx.audit('matrix.command.handled', {
      traceId,
      command: '!share_doc',
      phase: 'failed',
      reason,
      roomId,
    });
    return { ignored: false, reply, phase: 'failed', traceId };
  }
}

export async function handleAsk(
  ctx: BotContext,
  tokens: string[],
  sender: string,
  roomId: string,
  traceId: string
): Promise<BotResult> {
  const question = tokens.slice(1).join(' ').trim();
  if (!question) {
    const reply = ctx.renderStatusMessage({
      action: 'ask',
      phase: 'failed',
      traceId,
      roomId,
      message: '用法: !ask <问题>',
    });
    await ctx.audit('matrix.command.handled', {
      traceId,
      command: '!ask',
      phase: 'failed',
      reason: 'invalid_args',
    });
    return { ignored: false, reply, phase: 'failed', traceId };
  }
  if (!ctx.weKnoraService) {
    const reply = ctx.renderStatusMessage({
      action: 'ask',
      phase: 'failed',
      traceId,
      roomId,
      message: 'RAG 知识库服务未启用',
    });
    await ctx.audit('matrix.command.handled', {
      traceId,
      command: '!ask',
      phase: 'failed',
      reason: 'service_unavailable',
    });
    return { ignored: false, reply, phase: 'failed', traceId };
  }
  const now = Date.now();
  const lastAsk = ctx.ragCooldowns.get(sender) || 0;
  if (now - lastAsk < 5000) {
    const reply = ctx.renderStatusMessage({
      action: 'ask',
      phase: 'failed',
      traceId,
      roomId,
      message: '操作太频繁，请稍后再试',
    });
    return { ignored: false, reply, phase: 'failed', traceId };
  }
  ctx.ragCooldowns.set(sender, now);
  try {
    const tenantId = ctx.resolveTenantId ? await ctx.resolveTenantId(roomId) : undefined;
    const result = await ctx.weKnoraService.query(question, tenantId || undefined);
    const sourcesText = result.sources.length
      ? '\n\n参考来源:\n' +
        result.sources
          .map((s) => `- ${s.title || s.id}${s.score ? ` (${s.score.toFixed(2)})` : ''}`)
          .join('\n')
      : '';
    const reply = ctx.renderStatusMessage({
      action: 'ask',
      phase: 'succeeded',
      traceId,
      roomId,
      message: `${result.answer}${sourcesText}`,
    });
    await ctx.audit('matrix.command.handled', {
      traceId,
      command: '!ask',
      phase: 'succeeded',
      roomId,
      tenantId,
    });
    return { ignored: false, reply, phase: 'succeeded', traceId };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'RAG query failed';
    const reply = ctx.renderStatusMessage({
      action: 'ask',
      phase: 'failed',
      traceId,
      roomId,
      message: reason,
    });
    await ctx.audit('matrix.command.handled', {
      traceId,
      command: '!ask',
      phase: 'failed',
      reason,
      roomId,
    });
    return { ignored: false, reply, phase: 'failed', traceId };
  }
}

export async function handleSearchKb(
  ctx: BotContext,
  tokens: string[],
  roomId: string,
  traceId: string
): Promise<BotResult> {
  const keyword = tokens.slice(1).join(' ').trim();
  if (!keyword) {
    const reply = ctx.renderStatusMessage({
      action: 'search_kb',
      phase: 'failed',
      traceId,
      roomId,
      message: '用法: !search_kb <关键词>',
    });
    await ctx.audit('matrix.command.handled', {
      traceId,
      command: '!search_kb',
      phase: 'failed',
      reason: 'invalid_args',
    });
    return { ignored: false, reply, phase: 'failed', traceId };
  }
  if (!ctx.weKnoraService) {
    const reply = ctx.renderStatusMessage({
      action: 'search_kb',
      phase: 'failed',
      traceId,
      roomId,
      message: 'RAG 知识库服务未启用',
    });
    await ctx.audit('matrix.command.handled', {
      traceId,
      command: '!search_kb',
      phase: 'failed',
      reason: 'service_unavailable',
    });
    return { ignored: false, reply, phase: 'failed', traceId };
  }
  try {
    const tenantId = ctx.resolveTenantId ? await ctx.resolveTenantId(roomId) : undefined;
    const results = await ctx.weKnoraService.search(keyword, tenantId || undefined);
    const lines = results
      .slice(0, 10)
      .map((r) => `- ${r.title || '未命名'} (score: ${Number(r.score || 0).toFixed(2)})`);
    const msg = lines.length
      ? `找到 ${results.length} 条结果:\n${lines.join('\n')}`
      : '未找到匹配的知识条目';
    const reply = ctx.renderStatusMessage({
      action: 'search_kb',
      phase: 'succeeded',
      traceId,
      roomId,
      message: msg,
    });
    await ctx.audit('matrix.command.handled', {
      traceId,
      command: '!search_kb',
      phase: 'succeeded',
      roomId,
      tenantId,
      resultCount: results.length,
    });
    return { ignored: false, reply, phase: 'succeeded', traceId };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'search failed';
    const reply = ctx.renderStatusMessage({
      action: 'search_kb',
      phase: 'failed',
      traceId,
      roomId,
      message: reason,
    });
    await ctx.audit('matrix.command.handled', {
      traceId,
      command: '!search_kb',
      phase: 'failed',
      reason,
      roomId,
    });
    return { ignored: false, reply, phase: 'failed', traceId };
  }
}
