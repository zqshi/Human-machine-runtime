/**
 * Studio Routes — /api/openclaw/studio/*
 *
 * 聚合查询用户 AI 资产（Agent + Skill + MCP），区分来源。
 *
 * ⚠️ STUB: 本路由文件当前全部返回模拟数据（未接入 DB 聚合查询）。前端 studio
 * 流程拿到的是假数据，不应作为真实资产依据。实装前调用方需知晓此为占位实现。
 */
import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Principal } from '../../middleware/auth.js';
import { newId } from '../../shared/utils.js';

function getUser(c: Context): Principal {
  return c.get('user') as Principal;
}

export function createStudioRoutes() {
  const app = new Hono();

  /**
   * GET /assets — 获取用户全部 AI 资产
   * 合并自建 + 已安装 + 组织共享
   */
  app.get('/assets', async (c) => {
    const _user = getUser(c);
    const tenantId = _user.tenantId || 'default';
    void tenantId; // will be used for DB queries

    // TODO: 从实际数据库聚合查询，当前返回模拟数据
    const items = [
      {
        id: 'agent-001',
        name: 'SQL 优化助手',
        type: 'Agent',
        origin: 'created',
        source: 'local',
        description: '专业的 SQL 查询优化专家，分析性能瓶颈并提供优化建议',
        version: 'v1.2.0',
        status: 'published',
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'agent-002',
        name: '客服助手',
        type: 'Agent',
        origin: 'created',
        source: 'local',
        description: '自动回复常见问题，支持知识库检索',
        status: 'draft',
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'skill-001',
        name: '报告生成',
        type: 'Skill',
        origin: 'installed',
        source: 'clawhub',
        description: '自动生成结构化优化报告',
        version: 'v2.1.0',
        status: 'published',
        icon: '📋',
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'skill-002',
        name: '数据可视化',
        type: 'Skill',
        origin: 'installed',
        source: 'clawhub',
        description: '生成图表和数据看板',
        version: 'v1.0.3',
        status: 'published',
        icon: '📊',
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'mcp-001',
        name: 'db-query',
        type: 'MCP',
        origin: 'created',
        source: 'local',
        description: '执行 SQL 查询并返回结构化结果',
        status: 'published',
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'skill-003',
        name: '智能摘要',
        type: 'Skill',
        origin: 'shared',
        source: 'tenant',
        description: '自动提取文档核心信息（组织内共享）',
        version: 'v1.5.0',
        status: 'published',
        icon: '✍️',
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'mcp-002',
        name: '云文档',
        type: 'MCP',
        origin: 'shared',
        source: 'tenant',
        description: '搜索和查询云文档（组织内共享）',
        status: 'published',
        updatedAt: new Date().toISOString(),
      },
    ];

    return c.json({ success: true, items });
  });

  /**
   * POST /assets/install — 从共享中心安装资产
   */
  app.post('/assets/install', async (c) => {
    getUser(c); // auth check
    const body = await c.req.json();
    void body.assetId;
    void body.source;

    // TODO: 实际写入安装记录
    return c.json({ success: true, id: newId('inst') });
  });

  /**
   * DELETE /assets/:id — 卸载已安装资产
   */
  app.delete('/assets/:id', async (c) => {
    void c.req.param('id');
    // TODO: 实际删除安装记录
    return c.json({ success: true });
  });

  /**
   * GET /agents/:id/config — 获取 Agent 编排配置
   */
  app.get('/agents/:id/config', async (c) => {
    void c.req.param('id');

    // TODO: 从 agent_configs 表读取
    return c.json({
      systemPrompt: '你是一个专业的 SQL 查询优化专家。',
      modelId: 'claude-sonnet-4',
      openingMessage: '你好！我是 SQL 优化助手，请输入你的 SQL 查询。',
      presetQuestions: ['帮我优化这个 SQL', '分析索引使用情况', '解释 EXPLAIN 输出'],
      shortcuts: ['慢查询分析', '索引建议'],
      humanize: true,
      webSearch: false,
      mcpRefs: [{ id: 'mcp-001', name: 'db-query', toolCount: 5 }],
      skillRefs: [{ id: 'skill-001', name: '报告生成', description: '自动生成结构化报告' }],
      knowledgeBaseIds: [],
      publishedVersion: 'v1.2.0',
    });
  });

  /**
   * PUT /agents/:id/config — 保存 Agent 编排配置（草稿）
   */
  app.put('/agents/:id/config', async (c) => {
    void c.req.param('id');
    await c.req.json(); // consume body

    // TODO: 写入 agent_configs 表
    return c.json({ success: true });
  });

  /**
   * POST /agents/:id/publish — 发布 Agent 配置
   */
  app.post('/agents/:id/publish', async (c) => {
    void c.req.param('id');
    const { version } = await c.req.json();

    // TODO: 快照当前配置为发布版本
    return c.json({ success: true, version });
  });

  return app;
}
