import type { AgentTask } from '../../domain/agent/AgentTask';
import type { MessageBlock, SuggestedActionsBlock } from '../../domain/agent/MessageBlock';
import type { Notification } from '../../domain/notification/Notification';
import type { CoTStep, ToolCall, KnowledgeRef, KnowledgeCitation } from '../../domain/agent/CoTMessage';

interface DiscussionResponse {
  text: string;
  html?: string;
  cotSteps: CoTStep[];
  blocks: MessageBlock[];
}

/** 简易中文关键词提取（去停用词、分词） */
export function extractKeywords(text: string): string[] {
  const STOP_WORDS = new Set([
    '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都',
    '一', '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会',
    '着', '没有', '看', '好', '自己', '这', '他', '吗', '可以', '已',
    '这个', '什么', '吗', '请', '对', '把', '还', '没', '能', '吧',
  ]);
  return [...new Set(
    text
      .replace(/[^\u4e00-\u9fff\w]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 2 && !STOP_WORDS.has(w)),
  )];
}

/** 简易 HTML 转义 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * 综合通知内容、外部对话历史、Agent 原始分析、进行中任务，
 * 生成一条包含完整现状总结 + 风险评估 + 行动建议的 Agent 回复。
 */
export function buildDeepDiscussionResponse(
  notification: Notification,
  channelLabel: string,
  activeTasks: AgentTask[],
  now: number,
): DiscussionResponse {
  const ctx = notification.contextMessages ?? [];
  const reaction = notification.agentReaction;
  const originalReasoning = reaction?.reasoningSteps ?? [];
  const isEmail = notification.channel === 'email';

  // ── 1. 梳理外部对话脉络（从 contextMessages 提取关键节点）──
  const ownMessages = ctx.filter((m) => m.isOwn);
  const externalMessages = ctx.filter((m) => !m.isOwn);
  const lastOwnMsg = ownMessages[ownMessages.length - 1];
  const recentExternalTrend = externalMessages.length >= 2
    ? `对方近期频率较高（${externalMessages.length} 条消息），注意响应及时性`
    : '';

  // ── 2. 任务全景扫描 ──
  const taskSummary: string[] = [];
  const runningSubtasks: string[] = [];
  const warnLogs: string[] = [];

  for (const task of activeTasks) {
    const subtaskDone = task.subtasks.filter((s) => s.status === 'success').length;
    const subtaskRunning = task.subtasks.find((s) => s.status === 'running');
    const subtaskPending = task.subtasks.filter((s) => s.status === 'pending').length;

    taskSummary.push(
      `${task.name}：进度 ${task.progress}%（${subtaskDone}/${task.subtasks.length} 子任务完成${subtaskPending > 0 ? `，${subtaskPending} 待执行` : ''}）`,
    );

    if (subtaskRunning) {
      runningSubtasks.push(`${task.name} 正在执行「${subtaskRunning.name}」`);
    }

    const warnings = task.logs.filter((l) => l.level === 'WARN' || l.level === 'ERROR');
    for (const w of warnings) {
      warnLogs.push(`[${task.name}] ${w.message}`);
    }
  }

  // ── 3. 关键词关联分析（通知内容 ↔ 任务名称）──
  const notificationKeywords = extractKeywords(notification.body + ' ' + (notification.title ?? ''));
  const relatedTasks: string[] = [];
  for (const task of activeTasks) {
    const taskKeywords = extractKeywords(task.name + ' ' + task.subtasks.map((s) => s.name).join(' '));
    const overlap = notificationKeywords.filter((k) => taskKeywords.includes(k));
    if (overlap.length > 0) {
      relatedTasks.push(`${task.name}（关联关键词：${overlap.join('、')}）`);
    }
  }

  // ── 4. 构建 CoT 推理链 ──
  const cotSteps: CoTStep[] = [];
  let stepCounter = 0;
  let toolCounter = 0;
  let knowledgeCounter = 0;

  const step = (label: string, detail: string, opts?: { toolCalls?: ToolCall[]; knowledgeRefs?: KnowledgeRef[] }) => {
    stepCounter++;
    cotSteps.push({
      id: `cs-${now}-${stepCounter}`,
      label,
      status: 'done' as const,
      detail,
      toolCalls: opts?.toolCalls,
      knowledgeRefs: opts?.knowledgeRefs,
    });
  };

  const tc = (name: string, icon: string, input: string, result?: string): ToolCall => {
    toolCounter++;
    return { id: `tc-${now}-${toolCounter}`, name, icon, status: 'done', input, result };
  };

  const kr = (name: string, icon: string, query: string, result: string, source?: string, citations?: KnowledgeCitation[]): KnowledgeRef => {
    knowledgeCounter++;
    return { id: `kr-${now}-${knowledgeCounter}`, name, icon, status: 'done', query, result, source, citations };
  };

  if (isEmail) {
    // 邮件专属推理链
    const subject = notification.title.replace(/^Email\s*·\s*/, '');
    const toField = notification.emailMeta?.to ?? '';
    const ccField = notification.emailMeta?.cc ?? '';

    step(
      '邮件解析',
      `主题: ${subject}，发件人: ${notification.sender.name}` +
      (toField ? `，收件人: ${toField}` : '') +
      (ccField ? `，抄送: ${ccField}` : '') +
      (ctx.length > 0 ? `，邮件往来: ${ctx.length} 封历史邮件` : '，独立邮件无历史往来'),
      {
        toolCalls: [
          tc('邮件解析器', 'mail', `解析邮件元数据与正文 — 主题: ${subject}`, `发件人: ${notification.sender.name}${toField ? `，收件人: ${toField}` : ''}，正文长度: ${notification.body.length} 字符`),
          ...(ctx.length > 0 ? [tc('邮件历史检索', 'history', `检索同主题邮件往来记录`, `找到 ${ctx.length} 封历史邮件，最早: ${ctx.length > 0 ? new Date(ctx[0].timestamp).toLocaleDateString('zh-CN') : '无'}`)] : []),
        ],
      },
    );

    step(
      '意图识别',
      `邮件内容分析：${notification.body.slice(0, 80)}${notification.body.length > 80 ? '…' : ''}` +
      (reaction?.summary ? `\nAgent 判断：${reaction.summary}` : ''),
      {
        toolCalls: [
          tc('NLU 意图分析', 'psychology', '对邮件正文进行意图分类', reaction?.summary ?? '意图识别中'),
        ],
        knowledgeRefs: [
          kr('邮件沟通规范', 'menu_book', '检索邮件回复礼仪与优先级规则', '商务邮件需 24h 内回复，紧急邮件需 4h 内响应', '公司沟通规范 v2.1', [
            { title: '邮件响应时效规范', type: 'sop', snippet: '商务邮件 24h、紧急邮件 4h、客户投诉 2h' },
            { title: '沟通礼仪指南 — 邮件篇', type: 'document', snippet: '回复需包含问候语、正文、签名三部分' },
          ]),
        ],
      },
    );

    step(
      '回复策略评估',
      reaction?.draftReply
        ? 'Agent 已生成回复草稿，可基于草稿进行修改后直接发送'
        : '尚未生成回复草稿，需要根据邮件意图和上下文草拟回复',
      reaction?.draftReply ? {
        toolCalls: [
          tc('回复生成器', 'edit_note', '基于意图 + 上下文生成邮件回复草稿', `已生成 ${reaction.draftReply.length} 字回复草稿`),
        ],
      } : undefined,
    );

    if (activeTasks.length > 0) {
      step(
        '任务关联检查',
        `当前 ${activeTasks.length} 个进行中任务：${taskSummary.join('；')}` +
        (relatedTasks.length > 0 ? `\n邮件与以下任务相关：${relatedTasks.join('；')}` : '\n邮件与当前任务无直接关联'),
        {
          toolCalls: [
            tc('任务状态查询', 'task_alt', `查询 ${activeTasks.length} 个进行中任务的实时状态`, taskSummary.join('；')),
          ],
        },
      );
    }

    step(
      '回复建议',
      '你可以告诉我：\n' +
      '- "直接发送草稿" — 采纳 Agent 建议的回复\n' +
      '- "修改回复，加上…" — 在草稿基础上调整\n' +
      '- "用更正式的语气重写" — 调整回复风格\n' +
      '- "转发给张总" — 转发邮件并附加说明',
    );
  } else {
    // 非邮件通用推理链
    step(
      '信息收集与事件定级',
      `来源: ${channelLabel}(${notification.sender.name})，类型: ${notification.type}，` +
      `对话上下文: ${ctx.length} 条历史消息，` +
      `Agent 原始判断: ${reaction?.summary ?? '未分析'}` +
      (reaction?.confidence ? `，置信度: ${reaction.confidence}` : '') +
      (notification.isNeedsHuman ? '，标记为待处理' : ''),
      {
        toolCalls: [
          tc('消息通道适配器', 'swap_horiz', `接收 ${channelLabel} 消息并解析元数据`, `来源: ${notification.sender.name}，类型: ${notification.type}，消息长度: ${notification.body.length} 字`),
          ...(ctx.length > 0
            ? [tc('对话历史检索', 'forum', `检索 ${notification.sender.name} 近期对话记录`, `获取 ${ctx.length} 条历史消息，你方回复 ${ownMessages.length} 次`)]
            : []),
        ],
        knowledgeRefs: [
          kr('事件定级规则', 'gavel', `依据消息类型(${notification.type}) + 来源渠道(${channelLabel})定级`, `置信度: ${reaction?.confidence ?? '未知'}${notification.isNeedsHuman ? '，需人工介入' : '，可自动处理'}`, '事件响应 SOP v1.4', [
            { title: '事件响应 SOP v1.4', type: 'sop', snippet: `${notification.type} 类型事件定级标准与处置流程` },
            { title: '客户分级矩阵', type: 'document', snippet: '按渠道、频率、角色综合评估客户优先级' },
          ]),
        ],
      },
    );

    const threadSummary = ctx.length > 0
      ? `完整对话线 ${ctx.length} 条：${notification.sender.name} 发起 → 你方 ${ownMessages.length} 次回复 → 当前等待处理。${recentExternalTrend}`
      : '无历史对话上下文，按独立事件处理。';
    step('对话脉络梳理', threadSummary, ctx.length > 0 ? {
      toolCalls: [
        tc('对话线程分析', 'timeline', `分析 ${ctx.length} 条消息的时序与语义关联`, `${notification.sender.name} 发起 ${externalMessages.length} 条，你方回复 ${ownMessages.length} 条${recentExternalTrend ? '，' + recentExternalTrend : ''}`),
      ],
    } : undefined);

    step(
      '任务全景评估',
      activeTasks.length > 0
        ? `当前 ${activeTasks.length} 个进行中任务：${taskSummary.join('；')}`
        : '当前无进行中任务，可全力处理此事件。',
      activeTasks.length > 0 ? {
        toolCalls: [
          tc('任务编排引擎', 'hub', `查询所有活跃任务实时状态`, `${activeTasks.length} 个任务运行中，${runningSubtasks.length} 个子任务执行中`),
        ],
      } : undefined,
    );

    if (relatedTasks.length > 0) {
      step(
        '关联分析',
        `事件内容与以下进行中任务存在关联：${relatedTasks.join('；')}。处理此事件可能影响关联任务进度或优先级。`,
        {
          toolCalls: [
            tc('语义关联匹配', 'join_inner', `将通知关键词与任务名称进行语义匹配`, `命中 ${relatedTasks.length} 个关联任务`),
          ],
        },
      );
    } else if (activeTasks.length > 0) {
      step(
        '关联分析',
        `事件内容与当前进行中任务无直接关键词关联，但需评估是否需要调整任务优先级。`,
        {
          toolCalls: [
            tc('语义关联匹配', 'join_inner', `将通知关键词与任务名称进行语义匹配`, '未发现直接关联，建议人工评估优先级'),
          ],
        },
      );
    }

    const riskParts: string[] = [];
    if (warnLogs.length > 0) {
      riskParts.push(`进行中任务告警: ${warnLogs.join('；')}`);
    }
    if (runningSubtasks.length > 0) {
      riskParts.push(`正在执行的关键子任务: ${runningSubtasks.join('；')}`);
    }
    if (notification.isNeedsHuman) {
      riskParts.push('此事件需要人工决策，不宜自动处理');
    }
    if (reaction?.confidence === 'low') {
      riskParts.push('Agent 置信度较低，建议人工复核');
    }
    step(
      '风险与阻塞点',
      riskParts.length > 0
        ? riskParts.join('；')
        : '当前未识别到显著风险点。',
      {
        toolCalls: warnLogs.length > 0
          ? [tc('日志告警扫描', 'warning', '扫描进行中任务的 WARN/ERROR 日志', `发现 ${warnLogs.length} 条告警`)]
          : undefined,
        knowledgeRefs: [
          kr('风险评估矩阵', 'security', '匹配当前场景的风险等级与应对策略', riskParts.length > 0 ? `识别到 ${riskParts.length} 项风险因素` : '未识别到显著风险', '风险管理手册 v2.0', [
            { title: '风险管理手册 v2.0', type: 'document', snippet: '风险等级矩阵：影响范围 × 发生概率' },
            { title: '安全应急预案', type: 'sop', snippet: '高危风险需 15 分钟内上报，中危风险 1 小时内处理' },
          ]),
        ],
      },
    );

    if (originalReasoning.length > 0) {
      step(
        '综合研判',
        `基于 ${originalReasoning.length} 步原始分析：${originalReasoning.map((r) => `[${r.label}] ${r.detail}`).join(' → ')}`,
        {
          knowledgeRefs: [
            kr('Agent 原始推理链', 'psychology', `检索 Agent 初始分析的 ${originalReasoning.length} 步推理结果`, originalReasoning.map((r) => r.label).join(' → '), 'Agent 内部推理引擎', originalReasoning.map((r) => ({
              title: r.label,
              type: 'document' as const,
              snippet: r.detail.slice(0, 60) + (r.detail.length > 60 ? '...' : ''),
            }))),
          ],
        },
      );
    }
  }

  // ── 5. 构建回复文本 ──
  const blocks: MessageBlock[] = [];
  const suggestedActions = reaction?.suggestedActions ?? [];
  const parts: string[] = [];

  if (isEmail) {
    const subject = notification.title.replace(/^Email\s*·\s*/, '');
    const emailDate = notification.timestamp
      ? new Date(notification.timestamp).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      : '';

    const htmlParts: string[] = [];

    htmlParts.push(`<p style="font-weight:600;color:#94a3b8;font-size:11px;margin:0 0 8px">邮件分析</p>`);
    htmlParts.push(`<div style="font-size:12px;color:#cbd5e1;line-height:1.6">`);
    htmlParts.push(`主题：<strong>${subject}</strong><br/>`);
    htmlParts.push(`发件人：${notification.sender.name}`);
    if (notification.emailMeta?.to) htmlParts.push(`<br/>收件人：${notification.emailMeta.to}`);
    htmlParts.push(`</div>`);

    if (reaction?.summary) {
      htmlParts.push(`<p style="font-size:11px;color:#94a3b8;font-style:italic;margin:8px 0">Agent 判断：${escapeHtml(reaction.summary)}</p>`);
    }

    if (activeTasks.length > 0) {
      htmlParts.push(`<p style="font-weight:600;color:#94a3b8;font-size:11px;margin:8px 0 4px">相关任务</p>`);
      htmlParts.push(`<ul style="margin:0;padding-left:16px;font-size:11px;color:#cbd5e1;line-height:1.8">`);
      for (const s of taskSummary) htmlParts.push(`<li>${escapeHtml(s)}</li>`);
      htmlParts.push(`</ul>`);
    }

    htmlParts.push(`<p style="font-size:11px;color:#64748b;margin:8px 0 0">你可以直接告诉我需要怎样调整回复，我会帮你重新草拟。</p>`);

    if (reaction?.draftReply) {
      const emailBlock: MessageBlock = {
        type: 'email-draft',
        from: '我',
        to: notification.sender.name,
        subject: `Re: ${subject}`,
        date: emailDate,
        body: reaction.draftReply,
      };
      blocks.push(emailBlock);
    }

    const textForFallback = parts.join('\n');
    return {
      text: textForFallback || htmlParts.join('\n'),
      html: htmlParts.join('\n'),
      cotSteps,
      blocks,
    };
  } else {
    parts.push(`**现状总结**`);
    parts.push(
      `${notification.sender.name}(${channelLabel})：${notification.body}` +
      (lastOwnMsg ? `\n上次回复：${lastOwnMsg.body}` : ''),
    );
    parts.push('');

    if (activeTasks.length > 0) {
      parts.push(`**当前任务状态**`);
      parts.push(taskSummary.map((s) => `- ${s}`).join('\n'));
      if (runningSubtasks.length > 0) {
        parts.push(`正在执行：${runningSubtasks.join('、')}`);
      }
      parts.push('');
    }

    if (relatedTasks.length > 0) {
      parts.push(`**关联任务**`);
      parts.push(relatedTasks.map((r) => `- ${r}`).join('\n'));
      parts.push('');
    }

    const riskParts2: string[] = [];
    if (warnLogs.length > 0) riskParts2.push(`进行中任务告警: ${warnLogs.join('；')}`);
    if (runningSubtasks.length > 0) riskParts2.push(`正在执行的关键子任务: ${runningSubtasks.join('；')}`);
    if (notification.isNeedsHuman) riskParts2.push('此事件需要人工决策，不宜自动处理');
    if (reaction?.confidence === 'low') riskParts2.push('Agent 置信度较低，建议人工复核');
    if (riskParts2.length > 0) {
      parts.push(`**风险提示**`);
      parts.push(riskParts2.map((r) => `- ${r}`).join('\n'));
      parts.push('');
    }

    if (reaction?.draftReply) {
      parts.push(`**建议回复**`);
      parts.push(reaction.draftReply);
      parts.push('');
    }

    if (reaction?.summary) {
      parts.push(`*Agent 分析：${reaction.summary}*`);
    }
  }

  // ── 6. 构建 blocks（建议操作，仅非邮件类型） ──
  if (!isEmail && suggestedActions.length > 0) {
    const actionBlock: SuggestedActionsBlock = {
      type: 'suggested-actions',
      title: '建议操作',
      actions: suggestedActions.map((a) => ({
        id: a.id,
        icon: a.icon,
        label: a.label,
        command: a.command,
      })),
    };

    if (relatedTasks.length > 0) {
      for (const task of activeTasks) {
        const taskKeywords = extractKeywords(task.name + ' ' + task.subtasks.map((s) => s.name).join(' '));
        const overlap = notificationKeywords.filter((k) => taskKeywords.includes(k));
        if (overlap.length > 0) {
          actionBlock.actions.push({
            id: `sa-task-${task.id}`,
            icon: 'engineering',
            label: `查看 ${task.name}`,
            command: `查看任务「${task.name}」的详细进度和推理过程`,
          });
        }
      }
    }

    blocks.push(actionBlock);
  }

  return {
    text: parts.join('\n'),
    cotSteps,
    blocks,
  };
}
