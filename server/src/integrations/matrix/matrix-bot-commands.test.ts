import type { BotContext, InstanceRow, MatrixCard } from './matrix-bot-types.js';
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

const SENDER = '@alice:home';
const ROOM = '!room:home';
const TRACE = 'trace-1';

// ---- 工厂:构造 mock BotContext ----
function makeRow(over: Partial<InstanceRow> = {}): InstanceRow {
  return {
    id: 'inst_1',
    name: '员工A',
    state: 'running',
    matrixRoomId: ROOM,
    runtime: { endpoint: 'http://rt' },
    ...over,
  };
}

function makeCtx(over: Partial<BotContext> = {}): BotContext {
  return {
    instanceService: {
      list: vi.fn(async () => [makeRow()]),
      get: vi.fn(async () => makeRow()),
      createFromMatrix: vi.fn(async () => makeRow({ id: 'inst_new' })),
      buildMatrixCard: vi.fn((): MatrixCard => ({ instanceId: 'inst_new', matrixRoomId: ROOM })),
      start: vi.fn(async () => makeRow({ state: 'running' })),
      stop: vi.fn(async () => makeRow({ state: 'stopped' })),
    },
    runtimeProxyService: null,
    documentService: null,
    weKnoraService: null,
    auditService: null,
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    ragCooldowns: new Map(),
    renderStatusMessage: vi.fn((i) => `[${i.action}:${i.phase}] ${i.message || ''}`.trim()),
    renderCardMessage: vi.fn((card) => `CARD:${card.instanceId || '?'}`),
    audit: vi.fn(async () => {}),
    buildProvisionRequestId: vi.fn(() => 'req_1'),
    buildCreatorProfile: vi.fn(async () => ({
      email: 'e@l.local',
      jobTitle: '通用岗位',
      jobCode: 'general',
      department: 'general',
    })),
    ...over,
  };
}

describe('handleCreateAgent', () => {
  it('无名称 -> failed + invalid_args 审计', async () => {
    const ctx = makeCtx();
    const res = await handleCreateAgent(ctx, ['!create_agent'], SENDER, ROOM, TRACE, {});
    expect(res.phase).toBe('failed');
    expect(res.reply).toContain('用法');
    expect(ctx.audit).toHaveBeenCalledWith(
      'matrix.command.handled',
      expect.objectContaining({
        command: '!create_agent',
        phase: 'failed',
        reason: 'invalid_args',
      })
    );
    expect(ctx.instanceService.createFromMatrix).not.toHaveBeenCalled();
  });

  it('成功路径', async () => {
    const ctx = makeCtx();
    const res = await handleCreateAgent(ctx, ['!create_agent', '小', '明'], SENDER, ROOM, TRACE, {
      eventId: 'ev_1',
    });
    expect(res.phase).toBe('succeeded');
    expect(ctx.buildCreatorProfile).toHaveBeenCalledWith(SENDER, {});
    expect(ctx.instanceService.createFromMatrix).toHaveBeenCalledWith(
      expect.objectContaining({
        name: '小 明',
        creator: SENDER,
        matrixRoomId: ROOM,
        requestId: 'req_1',
      })
    );
    expect(res.reply).toContain('CARD:inst_new');
    expect(res.reply).toContain('requestId: req_1');
    expect(ctx.audit).toHaveBeenCalledWith(
      'matrix.command.handled',
      expect.objectContaining({
        command: '!create_agent',
        phase: 'succeeded',
        instanceId: 'inst_new',
      })
    );
  });

  it('createFromMatrix 抛错 -> failed + reason', async () => {
    const ctx = makeCtx({
      instanceService: {
        ...makeCtx().instanceService,
        createFromMatrix: vi.fn(async () => {
          throw new Error('boom');
        }),
      },
    });
    const res = await handleCreateAgent(ctx, ['!create_agent', 'X'], SENDER, ROOM, TRACE, {});
    expect(res.phase).toBe('failed');
    expect(res.reply).toContain('boom');
    expect(ctx.audit).toHaveBeenCalledWith(
      'matrix.command.handled',
      expect.objectContaining({
        command: '!create_agent',
        phase: 'failed',
        reason: 'boom',
      })
    );
  });
});

describe('handleListAgents', () => {
  it('有数据 -> 列出 + 计数', async () => {
    const ctx = makeCtx({
      instanceService: {
        ...makeCtx().instanceService,
        list: vi.fn(async () => [makeRow(), makeRow({ id: 'i2', name: 'B' })]),
      },
    });
    const res = await handleListAgents(ctx, ROOM, TRACE);
    expect(res.phase).toBe('succeeded');
    expect(res.reply).toContain('共 2 个数字员工');
    expect(res.reply).toContain('员工A');
    expect(ctx.audit).toHaveBeenCalledWith(
      'matrix.command.handled',
      expect.objectContaining({
        command: '!list_agents',
        rows: 2,
      })
    );
  });

  it('空列表 -> 暂无数字员工', async () => {
    const ctx = makeCtx({
      instanceService: { ...makeCtx().instanceService, list: vi.fn(async () => []) },
    });
    const res = await handleListAgents(ctx, ROOM, TRACE);
    expect(res.phase).toBe('succeeded');
    expect(res.reply).toContain('暂无数字员工');
    expect(ctx.audit).toHaveBeenCalledWith(
      'matrix.command.handled',
      expect.objectContaining({
        rows: 0,
      })
    );
  });
});

describe('handleAgentStatus', () => {
  it('无 id -> failed', async () => {
    const ctx = makeCtx();
    const res = await handleAgentStatus(ctx, ['!agent_status'], ROOM, TRACE);
    expect(res.phase).toBe('failed');
    expect(res.reply).toContain('用法');
    expect(ctx.instanceService.get).not.toHaveBeenCalled();
  });

  it('成功 -> 含 name|id|state|endpoint', async () => {
    const ctx = makeCtx();
    const res = await handleAgentStatus(ctx, ['!agent_status', 'inst_1'], ROOM, TRACE);
    expect(res.phase).toBe('succeeded');
    expect(res.reply).toContain('员工A');
    expect(res.reply).toContain('inst_1');
    expect(res.reply).toContain('running');
    expect(res.reply).toContain('http://rt');
  });
});

describe('handleJobStatus', () => {
  it('无 requestId -> failed', async () => {
    const ctx = makeCtx();
    const res = await handleJobStatus(ctx, ['!job_status'], ROOM, TRACE);
    expect(res.phase).toBe('failed');
    expect(res.reply).toContain('用法');
  });

  it('服务未启用 getProvisioningJob -> service_unavailable', async () => {
    const ctx = makeCtx(); // 默认无 getProvisioningJob
    const res = await handleJobStatus(ctx, ['!job_status', 'req_1'], ROOM, TRACE);
    expect(res.phase).toBe('failed');
    expect(res.reply).toContain('未启用');
    expect(ctx.audit).toHaveBeenCalledWith(
      'matrix.command.handled',
      expect.objectContaining({
        reason: 'service_unavailable',
      })
    );
  });

  it('成功 -> 含 phase/attempts', async () => {
    const ctx = makeCtx({
      instanceService: {
        ...makeCtx().instanceService,
        getProvisioningJob: vi.fn(async () => ({
          status: 'ok',
          phase: 'completed',
          instanceId: 'inst_1',
          attempts: 2,
        })),
      },
    });
    const res = await handleJobStatus(ctx, ['!job_status', 'req_1'], ROOM, TRACE);
    expect(res.phase).toBe('succeeded');
    expect(res.reply).toContain('phase=completed');
    expect(res.reply).toContain('attempts=2');
    // instanceId 作为 StatusInput 字段传入 renderStatusMessage
    expect(ctx.renderStatusMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'inst_1',
      })
    );
  });

  it('查询抛错 -> failed + reason', async () => {
    const ctx = makeCtx({
      instanceService: {
        ...makeCtx().instanceService,
        getProvisioningJob: vi.fn(async () => {
          throw new Error('not found');
        }),
      },
    });
    const res = await handleJobStatus(ctx, ['!job_status', 'req_x'], ROOM, TRACE);
    expect(res.phase).toBe('failed');
    expect(res.reply).toContain('not found');
  });
});

describe('handleStartAgent / handleStopAgent', () => {
  it('start 无 id -> failed', async () => {
    const ctx = makeCtx();
    const res = await handleStartAgent(ctx, ['!start_agent'], ROOM, TRACE);
    expect(res.phase).toBe('failed');
    expect(ctx.instanceService.start).not.toHaveBeenCalled();
  });

  it('start 成功 -> 已启动', async () => {
    const ctx = makeCtx();
    const res = await handleStartAgent(ctx, ['!start_agent', 'inst_1'], ROOM, TRACE);
    expect(res.phase).toBe('succeeded');
    expect(res.reply).toContain('已启动');
    expect(ctx.instanceService.start).toHaveBeenCalledWith('inst_1');
  });

  it('stop 无 id -> failed', async () => {
    const ctx = makeCtx();
    const res = await handleStopAgent(ctx, ['!stop_agent'], ROOM, TRACE);
    expect(res.phase).toBe('failed');
    expect(ctx.instanceService.stop).not.toHaveBeenCalled();
  });

  it('stop 成功 -> 已停止', async () => {
    const ctx = makeCtx();
    const res = await handleStopAgent(ctx, ['!stop_agent', 'inst_1'], ROOM, TRACE);
    expect(res.phase).toBe('succeeded');
    expect(res.reply).toContain('已停止');
    expect(ctx.instanceService.stop).toHaveBeenCalledWith('inst_1');
  });
});

describe('handleCreateDoc', () => {
  it('无标题 -> failed', async () => {
    const ctx = makeCtx();
    const res = await handleCreateDoc(ctx, ['!create_doc'], SENDER, ROOM, TRACE);
    expect(res.phase).toBe('failed');
    expect(res.reply).toContain('用法');
  });

  it('documentService 未启用 -> service_unavailable', async () => {
    const ctx = makeCtx({ documentService: null });
    const res = await handleCreateDoc(ctx, ['!create_doc', '标题'], SENDER, ROOM, TRACE);
    expect(res.phase).toBe('failed');
    expect(res.reply).toContain('文档服务未启用');
  });

  it('成功 -> 含 docId + drawerContent', async () => {
    const ctx = makeCtx({
      documentService: {
        create: vi.fn(async () => ({ id: 'doc_1', title: '标题' })),
        get: vi.fn(async () => ({ id: 'doc_1', title: '标题', type: 'doc', content: {} })),
      },
    });
    const res = await handleCreateDoc(ctx, ['!create_doc', '标题'], SENDER, ROOM, TRACE);
    expect(res.phase).toBe('succeeded');
    expect(res.reply).toContain('doc_1');
    expect(res.drawerContent).toEqual({
      type: 'doc',
      title: '标题',
      data: { docId: 'doc_1', html: '' },
    });
    expect(ctx.documentService!.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '标题',
        type: 'doc',
        createdBy: SENDER,
      })
    );
  });

  it('create 抛错 -> failed + reason', async () => {
    const ctx = makeCtx({
      documentService: {
        create: vi.fn(async () => {
          throw new Error('disk full');
        }),
        get: vi.fn(async () => ({ id: '', title: '', type: 'doc', content: {} })),
      },
    });
    const res = await handleCreateDoc(ctx, ['!create_doc', 'X'], SENDER, ROOM, TRACE);
    expect(res.phase).toBe('failed');
    expect(res.reply).toContain('disk full');
  });
});

describe('handleShareDoc', () => {
  it('无 docId -> failed', async () => {
    const ctx = makeCtx();
    const res = await handleShareDoc(ctx, ['!share_doc'], ROOM, TRACE);
    expect(res.phase).toBe('failed');
  });

  it('documentService 未启用 -> service_unavailable', async () => {
    const ctx = makeCtx({ documentService: null });
    const res = await handleShareDoc(ctx, ['!share_doc', 'doc_1'], ROOM, TRACE);
    expect(res.phase).toBe('failed');
    expect(res.reply).toContain('文档服务未启用');
  });

  it('成功 -> drawerContent 含 type/title/docId + content 合并', async () => {
    const ctx = makeCtx({
      documentService: {
        create: vi.fn(async () => ({ id: 'doc_1', title: 'T' })),
        get: vi.fn(async () => ({
          id: 'doc_1',
          title: '文档X',
          type: 'doc',
          content: { foo: 'bar' },
        })),
      },
    });
    const res = await handleShareDoc(ctx, ['!share_doc', 'doc_1'], ROOM, TRACE);
    expect(res.phase).toBe('succeeded');
    expect(res.reply).toContain('文档X');
    expect(res.drawerContent).toEqual({
      type: 'doc',
      title: '文档X',
      data: { docId: 'doc_1', foo: 'bar' },
    });
  });

  it('get 抛错 -> failed + reason', async () => {
    const ctx = makeCtx({
      documentService: {
        create: vi.fn(async () => ({ id: '', title: '' })),
        get: vi.fn(async () => {
          throw new Error('404');
        }),
      },
    });
    const res = await handleShareDoc(ctx, ['!share_doc', 'x'], ROOM, TRACE);
    expect(res.phase).toBe('failed');
    expect(res.reply).toContain('404');
  });
});

describe('handleAsk', () => {
  it('无问题 -> failed', async () => {
    const ctx = makeCtx();
    const res = await handleAsk(ctx, ['!ask'], SENDER, ROOM, TRACE);
    expect(res.phase).toBe('failed');
    expect(res.reply).toContain('用法');
  });

  it('weKnoraService 未启用 -> service_unavailable', async () => {
    const ctx = makeCtx({ weKnoraService: null });
    const res = await handleAsk(ctx, ['!ask', '问题'], SENDER, ROOM, TRACE);
    expect(res.phase).toBe('failed');
    expect(res.reply).toContain('RAG 知识库服务未启用');
  });

  it('冷却期内 -> failed(操作太频繁) 且不调用 query', async () => {
    const ctx = makeCtx({
      weKnoraService: {
        query: vi.fn(async () => ({ answer: 'a', sources: [] })),
        search: vi.fn(async () => []),
      },
      ragCooldowns: new Map([[SENDER, Date.now()]]),
    });
    const res = await handleAsk(ctx, ['!ask', '问题'], SENDER, ROOM, TRACE);
    expect(res.phase).toBe('failed');
    expect(res.reply).toContain('操作太频繁');
    expect(ctx.weKnoraService!.query).not.toHaveBeenCalled();
  });

  it('成功 -> 含 answer + sources(含 score)', async () => {
    const ctx = makeCtx({
      weKnoraService: {
        query: vi.fn(async () => ({
          answer: '答案是 A',
          sources: [{ id: 's1', title: '文档1', score: 0.9 }],
        })),
        search: vi.fn(async () => []),
      },
    });
    const res = await handleAsk(ctx, ['!ask', '问题'], SENDER, ROOM, TRACE);
    expect(res.phase).toBe('succeeded');
    expect(res.reply).toContain('答案是 A');
    expect(res.reply).toContain('文档1');
    expect(res.reply).toContain('(0.90)');
    // 冷却被写入
    expect(ctx.ragCooldowns.get(SENDER)).toBeGreaterThan(0);
  });

  it('query 抛错 -> failed + reason', async () => {
    const ctx = makeCtx({
      weKnoraService: {
        query: vi.fn(async () => {
          throw new Error('rag down');
        }),
        search: vi.fn(async () => []),
      },
    });
    const res = await handleAsk(ctx, ['!ask', '问题'], SENDER, ROOM, TRACE);
    expect(res.phase).toBe('failed');
    expect(res.reply).toContain('rag down');
  });

  it('resolveTenantId 提供时传入 query', async () => {
    const query = vi.fn(async () => ({ answer: 'a', sources: [] }));
    const ctx = makeCtx({
      weKnoraService: { query, search: vi.fn(async () => []) },
      resolveTenantId: vi.fn(async () => 'tn_1'),
    });
    await handleAsk(ctx, ['!ask', '问题'], SENDER, ROOM, TRACE);
    expect(query).toHaveBeenCalledWith('问题', 'tn_1');
  });
});

describe('handleSearchKb', () => {
  it('无关键词 -> failed', async () => {
    const ctx = makeCtx();
    const res = await handleSearchKb(ctx, ['!search_kb'], ROOM, TRACE);
    expect(res.phase).toBe('failed');
    expect(res.reply).toContain('用法');
  });

  it('weKnoraService 未启用 -> service_unavailable', async () => {
    const ctx = makeCtx({ weKnoraService: null });
    const res = await handleSearchKb(ctx, ['!search_kb', 'kw'], ROOM, TRACE);
    expect(res.phase).toBe('failed');
    expect(res.reply).toContain('RAG 知识库服务未启用');
  });

  it('成功 -> top10 + score 格式化', async () => {
    const ctx = makeCtx({
      weKnoraService: {
        query: vi.fn(async () => ({ answer: '', sources: [] })),
        search: vi.fn(async () => [
          { title: 'A', score: 0.123456 },
          { title: 'B', score: 0.5 },
          { content: '无标题', score: 0 },
        ]),
      },
    });
    const res = await handleSearchKb(ctx, ['!search_kb', 'kw'], ROOM, TRACE);
    expect(res.phase).toBe('succeeded');
    expect(res.reply).toContain('找到 3 条结果');
    expect(res.reply).toContain('A');
    expect(res.reply).toContain('score: 0.12');
    expect(res.reply).toContain('未命名');
  });

  it('空结果 -> 未找到', async () => {
    const ctx = makeCtx({
      weKnoraService: {
        query: vi.fn(async () => ({ answer: '', sources: [] })),
        search: vi.fn(async () => []),
      },
    });
    const res = await handleSearchKb(ctx, ['!search_kb', 'kw'], ROOM, TRACE);
    expect(res.phase).toBe('succeeded');
    expect(res.reply).toContain('未找到');
  });

  it('search 抛错 -> failed + reason', async () => {
    const ctx = makeCtx({
      weKnoraService: {
        query: vi.fn(async () => ({ answer: '', sources: [] })),
        search: vi.fn(async () => {
          throw new Error('index broken');
        }),
      },
    });
    const res = await handleSearchKb(ctx, ['!search_kb', 'kw'], ROOM, TRACE);
    expect(res.phase).toBe('failed');
    expect(res.reply).toContain('index broken');
  });
});
