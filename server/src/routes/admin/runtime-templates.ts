import { Hono } from 'hono';
import {
  RuntimeRegistry,
  BUILTIN_SANDBOX_TEMPLATES,
} from '../../contexts/agent-core/domain/runtime-registry.js';

/**
 * 运行时/沙箱模板管理路由(admin 控制面,T6 治本 D8 后端侧)。
 *
 * 薄层(§1.3):返回内置 sandbox 模板定义 + 声明态 runtimeType→adapter 映射(只读)。
 * 当前内置模板为常量定义(管理后台展示 + 校验复用);动态 CRUD 留待后续版本。
 * auth:由 admin 聚合层统一挂(见 routes/index.ts)。
 */
export function createAdminRuntimeTemplateRoutes() {
  const app = new Hono();
  const registry = new RuntimeRegistry();

  app.get('/sandbox-templates', (c) => {
    return c.json({ items: registry.listSandboxTemplates() });
  });

  app.get('/sandbox-templates/:name', (c) => {
    const t = registry.getSandboxTemplate(c.req.param('name'));
    if (!t) return c.json({ error: 'template not found' }, 404);
    return c.json(t);
  });

  /** 声明态 runtimeType → AgentFramework adapter 映射(治本 D8,前端创建向导展示用) */
  app.get('/runtime-types', (c) => {
    const types = ['claude', 'cockpit', 'hermes'] as const;
    return c.json({
      items: types.map((t) => ({
        runtimeType: t,
        framework: registry.mapRuntimeType(t),
      })),
    });
  });

  app.get('/sandbox-templates-summary', (c) => {
    return c.json({
      builtIn: BUILTIN_SANDBOX_TEMPLATES.length,
      default: 'basic',
    });
  });

  return app;
}
