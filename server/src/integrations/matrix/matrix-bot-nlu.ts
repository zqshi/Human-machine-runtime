import type { BotContext, BotResult, EmployeeProfile } from './matrix-bot-types.js';

export function isNaturalCreateIntent(text: string): boolean {
  const raw = text.trim().toLowerCase();
  if (!raw) return false;
  const zh = raw.includes('创建') || raw.includes('新建') || raw.includes('生成');
  const target =
    raw.includes('数字员工') ||
    raw.includes('agent') ||
    raw.includes('机器人') ||
    raw.includes('bot');
  const en = /create\s+(a|an)?\s*(digital\s*)?(agent|employee|bot)/i.test(raw);
  return (zh && target) || en;
}

export function isNaturalRagIntent(text: string): boolean {
  const raw = text.trim().toLowerCase();
  if (!raw || raw.length < 6) return false;
  const actionWords = ['帮我查', '查一下', '搜索一下', '找一下', '检索'];
  const targetWords = ['知识库', '文档', '资料', '规范', '流程', '规划', '方案', '报告'];
  const hasAction = actionWords.some((w) => raw.includes(w));
  const hasTarget = targetWords.some((w) => raw.includes(w));
  return hasAction && hasTarget;
}

export function extractEmployeeName(text: string): string {
  const patterns = [
    /(?:叫|名为|名字是)\s*[""]?([a-zA-Z0-9_\-一-龥]{2,40})[""]?/i,
    /(?:create|new)\s+(?:an?\s+)?(?:agent|bot|employee)\s+(?:named\s+)?[""]?([a-zA-Z0-9_\-一-龥]{2,40})[""]?/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1]) return m[1].trim();
  }
  return '';
}

export function inferJobTitle(text: string): string {
  const raw = text.toLowerCase();
  const map: [string, string][] = [
    ['采购', '采购专员'],
    ['财务', '财务专员'],
    ['法务', '法务专员'],
    ['人事', '人事专员'],
    ['hr', '人事专员'],
    ['运维', '运维工程师'],
    ['开发', '开发工程师'],
    ['engineer', '开发工程师'],
    ['测试', '测试工程师'],
    ['qa', '测试工程师'],
    ['产品', '产品经理'],
    ['运营', '运营专员'],
    ['销售', '销售专员'],
  ];
  for (const [k, title] of map) {
    if (raw.includes(k)) return title;
  }
  return '通用岗位';
}

export function defaultEmployeeName(text: string): string {
  const job = inferJobTitle(text);
  if (job && job !== '通用岗位') return `${job}数字员工`;
  return `数字员工-${Date.now().toString().slice(-6)}`;
}

export function toJobCode(jobTitle: string): string {
  if (jobTitle.includes('采购')) return 'procurement';
  if (jobTitle.includes('财务')) return 'finance';
  if (jobTitle.includes('法务')) return 'legal';
  if (jobTitle.includes('人事')) return 'hr';
  if (jobTitle.includes('运维')) return 'ops';
  if (jobTitle.includes('开发')) return 'dev';
  if (jobTitle.includes('测试')) return 'qa';
  if (jobTitle.includes('产品')) return 'pm';
  if (jobTitle.includes('运营')) return 'ops';
  if (jobTitle.includes('销售')) return 'sales';
  return 'general';
}

export function normalizeLocalpart(userId: string): string {
  const noAt = userId.startsWith('@') ? userId.slice(1) : userId;
  const idx = noAt.indexOf(':');
  return (idx >= 0 ? noAt.slice(0, idx) : noAt).replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 64);
}

export async function buildCreatorProfile(
  resolveIdentityProfile: ((sender: string) => Promise<Partial<EmployeeProfile> | null>) | null,
  sender: string,
  intent: { jobTitle?: string } = {}
): Promise<EmployeeProfile> {
  const localpart = normalizeLocalpart(sender) || 'employee';
  const jobTitle = (intent.jobTitle || '').trim() || '通用岗位';
  const fallback: EmployeeProfile = {
    email: `${localpart}@digital-employee.local`,
    jobTitle,
    jobCode: toJobCode(jobTitle),
    department: jobTitle.includes('财务')
      ? 'finance'
      : jobTitle.includes('采购')
        ? 'procurement'
        : jobTitle.includes('法务')
          ? 'legal'
          : 'general',
  };
  if (!resolveIdentityProfile) return fallback;
  try {
    const resolved = await resolveIdentityProfile(sender);
    if (!resolved) return fallback;
    return {
      ...fallback,
      ...resolved,
      email: (resolved.email || fallback.email || '').trim(),
      jobTitle: (resolved.jobTitle || fallback.jobTitle || '').trim(),
      jobCode: (resolved.jobCode || fallback.jobCode || '').trim(),
      department: (resolved.department || fallback.department || '').trim(),
      employeeNo: (resolved.employeeNo || '').trim(),
      employeeId: (resolved.employeeId || '').trim(),
      enterpriseUserId: (resolved.enterpriseUserId || '').trim(),
    };
  } catch {
    return fallback;
  }
}

export async function tryHandleNaturalCreateIntent(
  ctx: BotContext,
  sender: string,
  roomId: string,
  body: string,
  traceId: string,
  meta: { eventId?: string }
): Promise<BotResult | null> {
  if (!isNaturalCreateIntent(body)) return null;
  const parsedName = extractEmployeeName(body);
  const inferredJob = inferJobTitle(body);
  const name = parsedName || defaultEmployeeName(body);
  const requestId = ctx.buildProvisionRequestId({
    roomId,
    sender,
    name,
    eventId: meta.eventId,
  });
  try {
    const creatorProfile = await ctx.buildCreatorProfile(sender, { jobTitle: inferredJob });
    const instance = await ctx.instanceService.createFromMatrix({
      name,
      creator: sender,
      matrixRoomId: roomId,
      requestId,
      employeeProfile: creatorProfile,
    });
    const card = ctx.instanceService.buildMatrixCard(instance);
    const reply = `${ctx.renderCardMessage(card, traceId)}\n- requestId: ${requestId}`;
    await ctx.audit('matrix.intent.create_agent.handled', {
      traceId,
      roomId,
      sender,
      requestId,
      phase: 'succeeded',
      instanceId: instance.id,
    });
    return { ignored: false, reply, card, phase: 'succeeded', traceId };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'create failed';
    await ctx.audit('matrix.intent.create_agent.handled', {
      traceId,
      roomId,
      sender,
      requestId,
      phase: 'failed',
      reason,
    });
    return {
      ignored: false,
      phase: 'failed',
      traceId,
      reply: ctx.renderStatusMessage({
        action: 'create_agent',
        phase: 'failed',
        traceId,
        requestId,
        roomId,
        message: reason,
      }),
    };
  }
}

export async function tryHandleNaturalRagIntent(
  ctx: BotContext,
  sender: string,
  roomId: string,
  body: string,
  traceId: string
): Promise<BotResult | null> {
  if (!ctx.weKnoraService || !isNaturalRagIntent(body)) return null;
  try {
    const tenantId = ctx.resolveTenantId ? await ctx.resolveTenantId(roomId) : undefined;
    const result = await ctx.weKnoraService.query(body, tenantId || undefined);
    if (!result.answer) return null;
    const sourcesText = result.sources.length
      ? '\n\n参考来源:\n' + result.sources.map((s) => `- ${s.title || s.id}`).join('\n')
      : '';
    const reply = `${result.answer}${sourcesText}`;
    await ctx.audit('matrix.intent.rag.handled', {
      traceId,
      roomId,
      sender,
      phase: 'succeeded',
    });
    return { ignored: false, reply, phase: 'succeeded', traceId };
  } catch {
    return null;
  }
}
