import { CoTMessage } from '../../domain/agent/CoTMessage';
import { useNotificationStore } from './notificationStore';
import { buildDeepDiscussionResponse } from './openclawConversationHelpers';
import type { StoreSet, StoreGet } from './openclawTypes';

export function handleSetDiscussingNotificationId(id: string | null, set: StoreSet, get: StoreGet) {
  const store = get();

  if (!id) {
    set({
      discussingNotificationId: null,
      discussingDecisionId: null,
      discussingTaskId: null,
      discussingGoalId: null,
      discussingWorkOrderId: null,
      bColumnTaskId: null,
      bColumnGoalId: null,
      composerPrefill: null,
      activeConversationId: 'primary',
    });
    useNotificationStore.getState().selectNotification(null);
    return;
  }

  const notification = useNotificationStore.getState().notifications.find((n) => n.id === id);
  if (!notification) return;

  useNotificationStore.getState().selectNotification(id);

  const convId = `discuss-${id}`;

  if (store.conversations[convId]?.length > 0) {
    set({
      discussingNotificationId: id,
      discussingDecisionId: null,
      discussingTaskId: null,
      discussingGoalId: null,
      discussingWorkOrderId: null,
      bColumnTaskId: null,
      bColumnGoalId: null,
      composerPrefill: null,
      activeConversationId: convId,
    });
    return;
  }

  const sessionId = store.sessionId ?? '';
  const now = Date.now();
  const channelLabel: Record<string, string> = {
    lark: '飞书',
    email: '邮件',
    slack: 'Slack',
    matrix: 'Matrix',
    wechat: '微信',
    teams: 'Teams',
  };
  const ch = channelLabel[notification.channel ?? ''] ?? notification.channel ?? '';
  const ctxMessages = notification.contextMessages ?? [];
  const activeTasks = store.tasks.filter((t) => t.isActive);

  const isEmail = notification.channel === 'email';
  const userSummaryParts: string[] = [];
  if (isEmail) {
    const subject = notification.title.replace(/^Email\s*·\s*/, '');
    userSummaryParts.push(`邮件主题：${subject}`);
    userSummaryParts.push(`发件人：${notification.sender.name}`);
    if (notification.emailMeta?.to) userSummaryParts.push(`收件人：${notification.emailMeta.to}`);
    if (notification.emailMeta?.cc) userSummaryParts.push(`抄送：${notification.emailMeta.cc}`);
    userSummaryParts.push(`邮件正文：${notification.body}`);
    if (ctxMessages.length > 0) userSummaryParts.push(`邮件往来历史 ${ctxMessages.length} 条`);
  } else {
    userSummaryParts.push(`来自 ${ch}(${notification.sender.name})：${notification.body}`);
    if (ctxMessages.length > 0) userSummaryParts.push(`相关对话 ${ctxMessages.length} 条`);
  }
  const userPrompt = isEmail
    ? `帮我分析这封邮件并草拟回复：\n${userSummaryParts.join('\n')}`
    : `帮我分析这条外部消息并给出处理建议：\n${userSummaryParts.join('\n')}`;
  const userMsg = CoTMessage.create({
    id: `discuss-user-${now}`,
    agentId: 'primary',
    sessionId,
    role: 'user',
    text: userPrompt,
    timestamp: now,
  });

  const analysis = buildDeepDiscussionResponse(notification, ch, activeTasks, now);

  const botMsg = CoTMessage.create({
    id: `discuss-agent-${now}`,
    agentId: 'primary',
    sessionId,
    role: 'agent',
    text: analysis.text,
    html: analysis.html,
    timestamp: now + 1,
    cotSteps: analysis.cotSteps,
    blocks: analysis.blocks,
  });

  set({
    activeConversationId: convId,
    conversations: {
      ...store.conversations,
      [convId]: [userMsg, botMsg],
    },
    discussingNotificationId: id,
    discussingDecisionId: null,
    discussingTaskId: null,
    discussingGoalId: null,
    discussingWorkOrderId: null,
    bColumnTaskId: null,
    bColumnGoalId: null,
    composerPrefill: null,
  });

  get().rebuildAttentionItems();
}

export function handleSetDiscussingDecisionId(id: string | null, set: StoreSet, get: StoreGet) {
  if (!id) {
    set({
      discussingDecisionId: null,
      discussingTaskId: null,
      discussingGoalId: null,
      discussingWorkOrderId: null,
      bColumnTaskId: null,
      bColumnGoalId: null,
      composerPrefill: null,
      activeConversationId: 'primary',
    });
    return;
  }

  const decision = get().decisionRequests.find((d) => d.id === id);
  if (!decision) return;

  const store = get();
  const convId = `discuss-decision-${id}`;
  const sessionId = store.sessionId ?? '';
  const now = Date.now();

  if (store.conversations[convId]?.length > 0) {
    set({
      discussingDecisionId: id,
      discussingNotificationId: null,
      discussingTaskId: null,
      discussingGoalId: null,
      discussingWorkOrderId: null,
      bColumnTaskId: null,
      bColumnGoalId: null,
      composerPrefill: null,
      activeConversationId: convId,
    });
    return;
  }

  const userMsg = CoTMessage.create({
    id: `discuss-dec-user-${now}`,
    agentId: 'primary',
    sessionId,
    role: 'user',
    text: `关于决策「${decision.title}」，推荐方案是「${decision.recommendation.label}」，请帮我分析各方案利弊。`,
    timestamp: now,
  });

  const allOptions = [decision.recommendation, ...decision.alternatives];
  const analysisParts: string[] = [];
  analysisParts.push(`**决策分析：${decision.title}**`);
  analysisParts.push('');
  analysisParts.push(`背景：${decision.context}`);
  analysisParts.push('');

  for (let i = 0; i < allOptions.length; i++) {
    const opt = allOptions[i];
    const prefix = i === 0 ? '推荐' : `备选${i}`;
    analysisParts.push(`**${prefix}：${opt.label}**`);
    analysisParts.push(`- 描述：${opt.description}`);
    analysisParts.push(
      `- 风险：${opt.riskLevel === 'low' ? '低' : opt.riskLevel === 'medium' ? '中' : '高'}`
    );
    analysisParts.push(`- 推理：${opt.reasoning}`);
    if (opt.estimatedImpact) analysisParts.push(`- 预估影响：${opt.estimatedImpact}`);
    analysisParts.push('');
  }

  analysisParts.push(`你可以告诉我：`);
  analysisParts.push(`- "采纳推荐方案" — 确认执行`);
  analysisParts.push(`- "为什么风险高？" — 深入分析某个方案`);
  analysisParts.push(`- "有没有其他选择？" — 探索更多可能性`);

  const botMsg = CoTMessage.create({
    id: `discuss-dec-agent-${now}`,
    agentId: 'primary',
    sessionId,
    role: 'agent',
    text: analysisParts.join('\n'),
    timestamp: now + 1,
    cotSteps: [
      {
        id: `cs-${now}-1`,
        label: '方案对比',
        status: 'done',
        detail: `共 ${allOptions.length} 个方案，推荐方案风险等级：${decision.recommendation.riskLevel}`,
      },
    ],
  });

  set({
    activeConversationId: convId,
    conversations: {
      ...store.conversations,
      [convId]: [userMsg, botMsg],
    },
    discussingDecisionId: id,
    discussingNotificationId: null,
    discussingTaskId: null,
    discussingGoalId: null,
    discussingWorkOrderId: null,
    bColumnTaskId: null,
    bColumnGoalId: null,
    composerPrefill: null,
  });

  get().rebuildAttentionItems();
}

export function handleSetDiscussingTaskId(id: string | null, set: StoreSet, get: StoreGet) {
  if (!id) {
    set({
      discussingTaskId: null,
      discussingNotificationId: null,
      discussingDecisionId: null,
      discussingGoalId: null,
      discussingWorkOrderId: null,
      bColumnTaskId: null,
      bColumnGoalId: null,
      composerPrefill: null,
      activeConversationId: 'primary',
    });
    return;
  }

  const task = get().tasks.find((t) => t.id === id);
  if (!task) return;

  const store = get();
  const convId = `task-${id}`;

  if (store.conversations[convId]?.length > 0) {
    set({
      discussingTaskId: id,
      discussingNotificationId: null,
      discussingDecisionId: null,
      discussingGoalId: null,
      discussingWorkOrderId: null,
      bColumnTaskId: null,
      bColumnGoalId: null,
      composerPrefill: null,
      activeConversationId: convId,
    });
    return;
  }

  const sessionId = store.sessionId ?? '';
  const now = Date.now();
  const subtaskSummary =
    task.subtasks.length > 0
      ? `\n子任务状态：${task.subtasks.map((s) => `${s.name}(${s.status})`).join('、')}`
      : '';

  const userMsg = CoTMessage.create({
    id: `discuss-task-user-${now}`,
    agentId: 'primary',
    sessionId,
    role: 'user',
    text: `请汇报「${task.name}」的最新进展，当前进度 ${task.progress}%。${subtaskSummary}`,
    timestamp: now,
  });

  const logSummary = task.logs
    .slice(-3)
    .map((l) => `[${l.level}] ${l.message}`)
    .join('\n');
  const botText = [
    `**任务「${task.name}」状态报告**`,
    '',
    `当前进度：${task.progress}%`,
    subtaskSummary ? `\n**子任务**${subtaskSummary}` : '',
    logSummary ? `\n**最新日志**\n${logSummary}` : '',
    '',
    '你可以告诉我：',
    '- "暂停任务" — 临时挂起',
    '- "查看推理过程" — 了解 Agent 决策逻辑',
    '- "调整优先级" — 重新排列子任务',
  ]
    .filter(Boolean)
    .join('\n');

  const botMsg = CoTMessage.create({
    id: `discuss-task-agent-${now}`,
    agentId: 'primary',
    sessionId,
    role: 'agent',
    text: botText,
    timestamp: now + 1,
    cotSteps: task.reasoningSteps?.map((s) => ({
      id: `cot-${s.label}`,
      label: s.label,
      detail: s.detail,
      status: 'done' as const,
    })),
  });

  set({
    activeConversationId: convId,
    conversations: {
      ...store.conversations,
      [convId]: [userMsg, botMsg],
    },
    discussingTaskId: id,
    discussingNotificationId: null,
    discussingDecisionId: null,
    discussingGoalId: null,
    discussingWorkOrderId: null,
    bColumnTaskId: null,
    bColumnGoalId: null,
    composerPrefill: null,
  });

  get().rebuildAttentionItems();
}

export function handleSetDiscussingGoalId(id: string | null, set: StoreSet, get: StoreGet) {
  if (!id) {
    set({
      discussingGoalId: null,
      discussingNotificationId: null,
      discussingDecisionId: null,
      discussingTaskId: null,
      discussingWorkOrderId: null,
      bColumnTaskId: null,
      bColumnGoalId: null,
      composerPrefill: null,
      activeConversationId: 'primary',
    });
    return;
  }

  const goal = get().goals.find((g) => g.id === id);
  if (!goal) return;

  const store = get();
  const convId = `goal-${id}`;

  if (store.conversations[convId]?.length > 0) {
    set({
      discussingGoalId: id,
      discussingNotificationId: null,
      discussingDecisionId: null,
      discussingTaskId: null,
      discussingWorkOrderId: null,
      bColumnTaskId: null,
      bColumnGoalId: null,
      composerPrefill: null,
      activeConversationId: convId,
    });
    return;
  }

  const sessionId = store.sessionId ?? '';
  const now = Date.now();
  const activeMilestone = goal.milestones.find((m) => m.status === 'active');
  const completedMilestones = goal.milestones.filter((m) => m.status === 'completed');

  const userMsg = CoTMessage.create({
    id: `discuss-goal-user-${now}`,
    agentId: 'primary',
    sessionId,
    role: 'user',
    text: `请汇报目标「${goal.title}」的整体进展，当前进度 ${goal.overallProgress}%。`,
    timestamp: now,
  });

  const milestoneSummary =
    goal.milestones.length > 0
      ? `\n**里程碑** (${completedMilestones.length}/${goal.milestones.length})\n${goal.milestones
          .map(
            (m) =>
              `- ${m.status === 'completed' ? '~~' : ''}${m.name}${m.status === 'completed' ? '~~' : ''} (${m.status === 'completed' ? '已完成' : m.status === 'active' ? '进行中' : '待开始'})`
          )
          .join('\n')}`
      : '';

  const botText = [
    `**目标「${goal.title}」进展报告**`,
    '',
    `整体进度：${goal.overallProgress}%`,
    activeMilestone ? `当前里程碑：${activeMilestone.name}` : '',
    milestoneSummary,
    '',
    '你可以告诉我：',
    '- "分析风险" — 评估目标达成的障碍',
    '- "调整里程碑" — 重新规划节点',
    '- "关联任务进展" — 查看任务对目标的贡献',
  ]
    .filter(Boolean)
    .join('\n');

  const botMsg = CoTMessage.create({
    id: `discuss-goal-agent-${now}`,
    agentId: 'primary',
    sessionId,
    role: 'agent',
    text: botText,
    timestamp: now + 1,
  });

  set({
    activeConversationId: convId,
    conversations: {
      ...store.conversations,
      [convId]: [userMsg, botMsg],
    },
    discussingGoalId: id,
    discussingNotificationId: null,
    discussingDecisionId: null,
    discussingTaskId: null,
    discussingWorkOrderId: null,
    bColumnTaskId: null,
    bColumnGoalId: null,
    composerPrefill: null,
  });

  get().rebuildAttentionItems();
}
