# 管理后台 (Admin Console) — 架构设计

> 版本 1.0 | 2026-04-14 | MVP 阶段

## 1. 产品形态

管理后台是 DCF Control Plane 的 B 端治理界面，面向平台管理员和租户管理员，采用 **Vanilla HTML/CSS/JS MPA（多页应用）** 架构——无前端框架，无构建步骤，每个页面一个 HTML 入口，通过 Express 静态文件服务提供。

### 1.1 技术选型理由

| 维度 | 决策 | 理由 |
|------|------|------|
| 无框架 | Vanilla JS | 后台页面数量固定、交互模式统一，无需 SPA 框架的路由/状态/组件体系 |
| MPA | 每页一个 HTML | 页面间无共享状态需求，刷新即重载，简化调试 |
| 无构建 | 直接 `<script>` 引入 | 修改即生效，本地开发零等待 |

### 1.2 文件规模

| 维度 | 数量 |
|------|------|
| HTML 页面 | 16 个 |
| JS 文件 | 23 个 |
| CSS 文件 | 5 个（1 入口 + 4 模块） |
| 总行数 | ~17,000 行 |

---

## 2. 目录结构

```
src/interfaces/http/admin-ui/
  layout.css                        # CSS 入口（@import 聚合）
  layout-base.css                   # 基础布局（shell/sidebar/content/card/table/toolbar）
  layout-drawer-a.css               # 抽屉样式 A（employee-drawer）
  layout-drawer-b.css               # 抽屉样式 B（附加面板）
  layout-extra.css                  # 扩展样式（特殊页面、动画、响应式）

  auth-core.js                      # 全局鉴权核心（JWT/权限/侧栏/页面门控）
  login.html / login.js             # 登录页

  openclaw-statistics.html / .js    # 数据统计（着陆页）
  openclaw-monitor.html / .js       # 平台运营（SLO/成本/保留策略）

  employees.html / .js              # 员工/实例管理
  employee-detail-renderer.js       # 员工详情渲染器
  employee-form-renderer.js         # 员工编辑表单渲染器

  shared-agents.html / .js          # 共享 Agent
  skills.html / .js                 # 技能管理
  skill-detail-renderer.js          # 技能详情渲染器
  tools.html / .js                  # 工具管理
  tools-approvals.html / .js        # 工具审批

  ai-gateway.html / .js             # AI Gateway（4-Tab 合并页）
  ai-gw.js                          # AI Gateway 核心逻辑
  ai-gateway-templates.js           # AI Gateway 模板管理

  notifications.html / .js          # 通知中心

  logs-service.html                 # 服务日志
  logs-agent.html                   # Agent 行为日志
  logs-admin.html                   # 后台操作日志
  logs.js                           # 日志通用逻辑
  logs-stats.js                     # 日志统计

  auth-members.html / .js           # 成员管理
  auth-users.html                   # 用户管理
  auth-roles.html / .js             # 角色管理
  auth.js                           # 权限通用逻辑
  auth-audit.js                     # 权限审计
  app.js                            # 全局脚本（路由辅助）
```

---

## 3. 架构模式

### 3.1 页面生命周期

```
HTML 加载
  → <link rel="stylesheet" href="/admin/layout.css" />
  → <script src="/admin/auth-core.js" />     ← 全局鉴权、侧栏渲染、权限门控
  → <script src="/admin/xxx-renderer.js" />  ← 可选：拆分出的渲染器
  → <script src="/admin/xxx.js" />           ← 主页面逻辑（IIFE 自执行）
```

### 3.2 IIFE + 依赖注入模式

JS 文件统一采用 IIFE（立即执行函数表达式）封装，通过依赖注入实现模块解耦：

```javascript
// xxx-renderer.js — 渲染器模块
(function(global) {
  function createXxxRenderer(deps) {
    const { getNode, escapeHtml, api, ... } = deps;
    
    function renderDetail(data) { /* ... */ }
    function fillForm(data) { /* ... */ }
    
    return { renderDetail, fillForm };
  }
  global.__adminXxxRenderer = { createXxxRenderer };
})(window);

// xxx.js — 主页面逻辑
(function() {
  // 公共工具
  const getNode = (id) => document.getElementById(id);
  const escapeHtml = (str) => /* ... */;
  async function api(url, opts) { /* ... */ }

  // 实例化渲染器
  const renderer = window.__adminXxxRenderer
    ? window.__adminXxxRenderer.createXxxRenderer({ getNode, escapeHtml, api, ... })
    : null;

  // 页面逻辑
  async function load() { /* ... */ }
  load();
})();
```

**模式要点**：
- 渲染器通过 `window.__adminXxxRenderer` 暴露工厂函数
- 主页面实例化渲染器时注入所有依赖（`getNode`, `escapeHtml`, `api` 等）
- 渲染器不直接访问 DOM ID 或全局状态——全部通过注入的 `deps` 间接访问
- 这使得渲染器可以独立测试、独立维护

**已应用此模式的页面**：
- `employees.js` → `employee-detail-renderer.js` + `employee-form-renderer.js`
- `skills.js` → `skill-detail-renderer.js`

### 3.3 CSS 模块化

```
layout.css                  # 聚合入口（4 行 @import）
  ├── layout-base.css       # 基础：admin-shell, sidebar, content, card, table, toolbar, stat-strip, page-head
  ├── layout-drawer-a.css   # 抽屉：employee-drawer, employee-drawer-mask, drawer 动画
  ├── layout-drawer-b.css   # 扩展抽屉：附加面板样式
  └── layout-extra.css      # 特殊：页面级覆盖、响应式断点、动画、主题变量
```

**核心 CSS 类约定**：

| 类名 | 用途 |
|------|------|
| `.admin-shell` | 页面根容器（flex，sidebar + content） |
| `.sidebar` | 左侧导航栏 |
| `.content` | 主内容区 |
| `.card` / `section.card` | 卡片容器 |
| `.table-wrap > table` | 表格 |
| `.table-pager` | 分页器 |
| `.toolbar` / `.filter-toolbar` | 工具栏 / 筛选栏 |
| `.stat-strip > .stat-item` | 统计指标条 |
| `.page-head` / `.page-title` | 页面头部 |
| `.employee-drawer` | 右侧详情/编辑抽屉 |
| `.employee-drawer-mask` | 抽屉蒙层 |
| `.admin-input` / `.admin-select` | 表单控件 |
| `.policy-grid` / `.policy-editor` | 策略编辑网格/编辑器 |
| `.hidden` | 隐藏元素（display: none） |

---

## 4. 权限体系

### 4.1 auth-core.js 职责

`auth-core.js` 是管理后台的**权限基础设施**，在所有页面中第一个加载，负责：

1. **JWT 管理**：从 localStorage 读取 token，过期跳转登录
2. **权限缓存**：`GET /api/auth/acl` 获取当前用户权限列表
3. **侧栏渲染**：根据 `DEFAULT_NAV_ITEMS` + 权限动态渲染侧栏链接
4. **页面级门控**：检查 `<body data-required-permission="xxx">`，无权限则拒绝加载
5. **元素级门控**：扫描 `[data-required-permission]` 属性，禁用/隐藏无权限元素
6. **兼容映射**：`TOOL_PERMISSION_COMPAT` / `ACTION_PERMISSION_COMPAT` / `PAGE_PERMISSION_COMPAT` 处理权限粒度升级的向后兼容

### 4.2 权限粒度

```
admin.{资源域}.{操作类型}
admin.{资源域}.page.{页面}.{read|write}
admin.{资源域}.action.{具体操作}
```

示例：
- `admin.employees.page.overview.read` — 员工列表页只读
- `admin.employees.write` — 员工编辑权限
- `admin.tools.action.approve-service` — 工具审批操作
- `admin.ai-gateway.page.read` — AI Gateway 页面读取

### 4.3 前端门控流程

```
页面加载
  → auth-core.js 执行
  → 检查 JWT（无效→跳转 login.html）
  → 请求 /api/auth/acl
  → 检查 body[data-required-permission]（无权限→显示"无权限"提示）
  → 渲染侧栏（隐藏无权限链接）
  → 扫描 [data-required-permission] 元素（禁用/隐藏）
  → 页面 JS 执行
  → canWriteXxx() 函数控制编辑按钮状态
```

---

## 5. 页面功能清单

### 5.1 运营类

| 页面 | JS 行数 | 功能 |
|------|--------|------|
| **数据统计** | 499 | Hero 卡片（实例/资产/审计/权限）、趋势图、快速入口 |
| **平台运营** | 460 | SLO 仪表盘、成本概览、审计保留策略、运行状态监控 |

### 5.2 资源管理类

| 页面 | JS 行数 | 功能 |
|------|--------|------|
| **员工管理** | 558+489+299 | 实例列表、6 维筛选、详情抽屉、编辑表单、治理边界、审批策略、大模型优化 |
| **共享 Agent** | 110 | Agent 列表、状态管理 |
| **技能管理** | 998+467 | 技能上报/审核/发布/绑定全链路、详情抽屉、调试开关 |
| **工具管理** | 376 | MCP 工具列表、健康检查、状态管理 |
| **工具审批** | 146 | 审批队列、通过/驳回/回滚操作 |

### 5.3 AI 类

| 页面 | JS 行数 | 功能 |
|------|--------|------|
| **AI Gateway** | 788+788+275 | 4-Tab 合并页（模型路由/模板管理/调用追踪/成本核算） |

### 5.4 通知与日志

| 页面 | JS 行数 | 功能 |
|------|--------|------|
| **通知中心** | 291 | 推送渠道管理、通知模板 |
| **行为日志** (×3) | 957+145 | Agent/服务/后台三类日志、actor 筛选、统计面板 |

### 5.5 权限类

| 页面 | JS 行数 | 功能 |
|------|--------|------|
| **账号权限** | 907+659+503+100 | 成员管理、用户 CRUD、角色 CRUD、权限审计 |

---

## 6. 交互模式

### 6.1 列表 + 筛选 + 抽屉（主模式）

```
┌──────────┬──────────────────────────────────────┐
│ sidebar  │  .page-head（标题 + 统计条）           │
│          ├──────────────────────────────────────┤
│          │  .filter-toolbar（搜索/筛选控件）      │
│          ├──────────────────────────────────────┤
│          │  .table-wrap > table                  │
│          │  ┌─────┬─────┬─────┬─────┬───────┐   │
│          │  │ ID  │ 名称 │ 状态 │ ... │ 操作  │   │
│          │  ├─────┼─────┼─────┼─────┼───────┤   │
│          │  │     │     │     │     │ 查看   │───┼──→ 打开右侧抽屉
│          │  │     │     │     │     │ 编辑   │───┼──→ 切换抽屉到编辑模式
│          │  └─────┴─────┴─────┴─────┴───────┘   │
│          ├──────────────────────────────────────┤
│          │  .table-pager（分页）                  │
└──────────┴──────────────────────────────────────┘
                                    ┌──────────────┐
                                    │ 抽屉（右侧）  │
                                    │ .employee-    │
                                    │  drawer       │
                                    │              │
                                    │ 查看模式：    │
                                    │  KPI 卡片     │
                                    │  详情字段     │
                                    │              │
                                    │ 编辑模式：    │
                                    │  表单         │
                                    │  策略编辑器   │
                                    │  保存按钮     │
                                    └──────────────┘
```

**应用此模式的页面**：员工管理、技能管理、工具管理、工具审批、通知中心、共享 Agent

### 6.2 多 Tab 合并页

AI Gateway 页使用 Tab 切换四个子视图：模型路由 / 模板管理 / 调用追踪 / 成本核算。

### 6.3 统计仪表盘

数据统计页和平台运营页使用 Hero 卡片 + 图表 + 快速入口布局。

---

## 7. 服务端集成

### 7.1 静态文件服务

```javascript
// src/app/createServer.js
const PURE_ADMIN_ALLOWED_FILES = new Set([
  'login.html', 'login.js',
  'employees.html', 'employees.js',
  'employee-detail-renderer.js',
  'employee-form-renderer.js',
  // ... 共 44 个文件
]);

app.use('/admin', (req, res, next) => {
  // 白名单校验：只允许 PURE_ADMIN_ALLOWED_FILES 中的文件
  // 防止目录遍历和未授权文件访问
});
app.use('/admin', express.static(adminUiDir, { etag: false, cacheControl: 'no-store' }));
```

**新增页面/文件时必须**：
1. 将文件名加入 `PURE_ADMIN_ALLOWED_FILES`
2. 在 `employees.html`（或目标页面）中添加 `<script>` 标签
3. 在 `auth-core.js` 的 `DEFAULT_NAV_ITEMS` 中添加导航项（如需侧栏入口）

### 7.2 API 调用约定

所有页面 JS 中的 `api()` 函数封装了统一的请求模式：

```javascript
async function api(url, opts = {}) {
  const token = localStorage.getItem('admin_token');
  const headers = { ...opts.headers, Authorization: `Bearer ${token}` };
  const res = await fetch(url, { ...opts, headers });
  if (res.status === 401) { location.href = '/admin/login.html'; return; }
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}
```

---

## 8. 代码质量现状

### 8.1 行数分布

| 范围 | 文件数 | 说明 |
|------|-------|------|
| 900-1000 行 | 3 | `skills.js`(998), `logs.js`(957), `auth-members.js`(907) |
| 600-900 行 | 4 | `ai-gw.js`(788), `ai-gateway.js`(788), `auth-core.js`(697), `auth.js`(659) |
| 300-600 行 | 7 | `employees.js`(558), `auth-roles.js`(503) 等主力文件 |
| <300 行 | 9 | 小型模块（含 `app.js` 6 行） |

### 8.2 已执行拆分

| 文件 | 拆分方案 |
|------|---------|
| `employees.js` (1009→558) | → `employee-detail-renderer.js`(299) + `employee-form-renderer.js`(489) |

### 8.3 待关注文件

| 文件 | 行数 | 建议 |
|------|------|------|
| `skills.js` | 998 | 类似 employees，拆出 `skill-form-renderer.js` |
| `logs.js` | 957 | 可按日志类型拆分辅助函数 |
| `auth-members.js` | 907 | 增长后考虑拆分 |
