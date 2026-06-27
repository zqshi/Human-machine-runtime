/* eslint-disable no-console -- seed 脚本面向 CLI，console 输出为预期行为 */
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import bcrypt from 'bcryptjs';
import { sql } from 'drizzle-orm';
import { config } from '../../config/index.js';
import * as schema from '../schema/index.js';
import type { SeedProfileName, SeedData } from './types.js';

async function loadProfile(name: SeedProfileName): Promise<SeedData> {
  if (name === 'production') {
    const mod = await import('./profiles/production.js');
    return mod.profile.seed;
  }
  const mod = await import('./profiles/showcase.js');
  return mod.profile.seed;
}

async function seed() {
  const profileName = (config.seed.profile || 'showcase') as SeedProfileName;
  const data = await loadProfile(profileName);

  console.log(`Seeding database with profile: ${profileName}`);

  const client = postgres(config.db.url, { max: 1 });
  const db = drizzle(client, { schema });

  const existing = await db.execute(sql`SELECT id FROM tenants WHERE id = ${data.tenant.id}`);
  const tenantExists = (existing as unknown as unknown[]).length > 0;

  if (!tenantExists) {
    const t = data.tenant;
    await db.execute(sql`
    INSERT INTO tenants (id, name, slug, plan, status, industry, company_size, contact_name, contact_email, description, quotas, features, model_access)
    VALUES (
      ${t.id}, ${t.name}, ${t.slug}, ${t.plan}, ${t.status},
      ${t.industry}, ${t.companySize}, ${t.contactName}, ${t.contactEmail},
      ${t.description}, ${JSON.stringify(t.quotas)}::jsonb, ${JSON.stringify(t.features)}::jsonb,
      ${JSON.stringify(t.modelAccess)}::jsonb
    )
    ON CONFLICT (id) DO NOTHING
  `);
    console.log(`  ✓ Tenant "${t.name}" created`);
  } else {
    console.log('  ✓ Tenant already exists, skipping');
  }

  for (const u of data.users) {
    const hash = u.password ? await bcrypt.hash(u.password, 10) : '';
    const passwordHash = u.password ? `bcrypt:${hash}` : '';
    const source = u.source || 'seed';
    await db.execute(sql`
      INSERT INTO users (username, password_hash, role, scope, tenant_id, display_name, email, source)
      VALUES (${u.username}, ${passwordHash}, ${u.role}, ${u.scope}, ${u.tenantId}, ${u.displayName}, ${u.email}, ${source})
      ON CONFLICT (username) DO NOTHING
    `);
    if (u.password) {
      console.log(`  ✓ User "${u.username}" (${u.role}) — password: ${u.password}`);
    } else {
      console.log(`  ✓ User "${u.username}" (${u.role}) — source: ${source}`);
    }
  }

  for (const inst of data.instances) {
    const resources = JSON.stringify({
      compute: { cpu: '500m', memory: '512Mi', gpu: null },
      model: { primaryModel: 'auto', fallbackModels: [], maxConcurrency: 5 },
      budget: { monthlyLimitCny: 0, dailyLimitCny: null, alertThresholdPct: 80 },
      storage: { persistentVolumeSize: '2Gi', tempStorageSize: '1Gi' },
      source: 'tenant_default',
      customizedAt: null,
      customizedBy: null,
    });
    await db.execute(sql`
      INSERT INTO instances (id, tenant_id, name, source, type, state, creator, employee_no, employee_id, job_title, department, resources)
      VALUES (${inst.id}, ${inst.tenantId}, ${inst.name}, ${inst.source}, ${inst.type}, ${inst.state},
              ${inst.creator}, ${inst.employeeNo}, ${inst.employeeId}, ${inst.jobTitle}, ${inst.department},
              ${resources}::jsonb)
      ON CONFLICT (id) DO NOTHING
    `);
    console.log(`  ✓ Instance "${inst.name}" (${inst.state})`);
  }

  const configValues = data.systemConfigs.map((c) => sql`(${c.key}, ${c.value}, ${c.description})`);
  if (configValues.length > 0) {
    for (const c of data.systemConfigs) {
      await db.execute(sql`
        INSERT INTO system_configs (key, value, description)
        VALUES (${c.key}, ${c.value}, ${c.description})
        ON CONFLICT (key) DO NOTHING
      `);
    }
    console.log(`  ✓ ${data.systemConfigs.length} system configs inserted`);
  }

  console.log(`\nSeed complete (profile: ${profileName})!`);

  // ──── Service Plans seed ────
  const { DEFAULT_QUOTAS } = await import('../../contexts/tenant-management/domain/tenant.js');
  const defaultFeatures = {
    aiGateway: true,
    knowledgeBase: true,
    matrixIntegration: false,
    customTools: true,
  };
  const planSeeds = [
    {
      id: 'plan_free',
      name: '免费版',
      slug: 'free',
      order: 0,
      desc: '基础功能体验',
      isDefault: false,
      quotas: DEFAULT_QUOTAS.free,
    },
    {
      id: 'plan_trial',
      name: '试用版',
      slug: 'trial',
      order: 1,
      desc: '限时试用完整功能',
      isDefault: false,
      quotas: DEFAULT_QUOTAS.trial,
    },
    {
      id: 'plan_standard',
      name: '标准版',
      slug: 'standard',
      order: 2,
      desc: '适合中小团队',
      isDefault: true,
      quotas: DEFAULT_QUOTAS.standard,
    },
    {
      id: 'plan_professional',
      name: '专业版',
      slug: 'professional',
      order: 3,
      desc: '适合成长型企业',
      isDefault: false,
      quotas: DEFAULT_QUOTAS.professional,
    },
    {
      id: 'plan_enterprise',
      name: '企业版',
      slug: 'enterprise',
      order: 4,
      desc: '大规模部署',
      isDefault: false,
      quotas: DEFAULT_QUOTAS.enterprise,
    },
  ];
  for (const p of planSeeds) {
    await db.execute(sql`
      INSERT INTO service_plans (id, name, slug, display_order, description, is_default, status, quota_template, feature_template)
      VALUES (${p.id}, ${p.name}, ${p.slug}, ${p.order}, ${p.desc}, ${p.isDefault}, 'active',
              ${JSON.stringify(p.quotas)}::jsonb, ${JSON.stringify(defaultFeatures)}::jsonb)
      ON CONFLICT (id) DO NOTHING
    `);
  }
  console.log(`  ✓ ${planSeeds.length} service plans seeded`);

  // ──── auth_providers: DB 工具源凭证 provider(T37 McpDatabaseFlow 真连接依赖) ────
  // credential-vault 的 createAuthorization 需 providerId(FK auth_providers.id)。
  // DB 工具源凭证(username/password)归属此 provider,不依赖 provider 的 auth 语义,仅作 FK 占位。
  await db.execute(sql`
    INSERT INTO auth_providers (code, name, auth_type, tenant_id, enabled, config)
    VALUES ('db-tools', 'Database Tool Source', 'basic', NULL, true, '{}'::jsonb)
    ON CONFLICT (code) DO NOTHING
  `);
  console.log('  ✓ auth_provider "db-tools" ensured (DB tool source credentials)');

  // ──── Default Roles seed ────
  await db.execute(sql`
    INSERT INTO user_roles (name, display_name, permissions)
    VALUES ('platform_admin', '平台管理员', ${JSON.stringify(['*'])}::jsonb)
    ON CONFLICT (name) DO NOTHING
  `);
  console.log('  ✓ Default role "platform_admin" ensured');

  // ──── Tool Sources + Definitions seed(v1.2.2 P0-1:实例任务工具闭环验证) ────
  // tool_definitions 表空时 ToolLoopExecutor.discover 返回空 → LLM 无工具可调直返 content,
  // 审批/凭证/计费/callLog 全不触发(T33 自陈的空转断点)。seed 1 个 enabled 工具让闭环可触发。
  // 工具指向 server 自身 /health(只读、无副作用、不依赖外网),invoke 时 server 在跑即可验证闭环。
  // 投产可替换为真实业务工具(MCP sync 入库或管理后台绑定)。
  await db.execute(sql`
    INSERT INTO tool_sources (id, tenant_id, source_type, name, description, status, health_status, tool_count, sync_strategy)
    VALUES ('tsrc_seed_demo', 'default', 'openapi', 'Demo Tool Source (seed)',
            '种子工具源:实例任务工具闭环验证(v1.2.2 P0-1)', 'active', 'healthy', 1, 'manual')
    ON CONFLICT (id) DO NOTHING
  `);
  await db.execute(sql`
    INSERT INTO tool_definitions (id, source_id, tenant_id, name, description, execution_type, execution_config, input_schema, enabled, status, risk_level, tags)
    VALUES (
      'tdef_seed_health', 'tsrc_seed_demo', 'default', 'check_system_health',
      '检查 HMR 服务健康状态(无参数,返回 JSON 健康指标)。种子工具,用于实例任务工具闭环验证。',
      'http_proxy',
      '{"baseUrl":"http://localhost:3002","path":"/health","method":"GET"}'::jsonb,
      '{"type":"object","properties":{},"additionalProperties":false}'::jsonb,
      true, 'active', 'low', '[]'::jsonb
    )
    ON CONFLICT (id) DO NOTHING
  `);
  // 路径B coding 工具:让 LLM 经 tool-loop 真实创建/读取文件(sandbox 执行器,隔离工作目录)。
  // 实测验证(glm-4-flash):LLM 真实创建 src/App.tsx React 组件。替换前端 AppCreateFlow 假表演。
  // 投产级需 docker 隔离(当前 server 进程内 fs,已做路径逃逸防护)。
  await db.execute(sql`
    INSERT INTO tool_definitions (id, source_id, tenant_id, name, description, execution_type, execution_config, input_schema, enabled, status, risk_level, tags)
    VALUES
    ('tdef_sandbox_write', 'tsrc_seed_demo', 'default', 'write_file',
     '向工作目录写入文件(创建/覆盖)。路径用相对路径(如 src/App.tsx),会自动解析到 /workspace 工作区下。用于创建应用代码、配置文件等。参数:path(相对路径,如 src/App.tsx,不可用..或绝对路径)、content(文件内容)。',
     'sandbox', '{"op":"write_file"}'::jsonb,
     '{"type":"object","properties":{"path":{"type":"string","description":"相对路径(不可含..或绝对路径)"},"content":{"type":"string","description":"文件内容"}},"required":["path","content"],"additionalProperties":false}'::jsonb,
     true, 'active', 'medium', '["coding","file"]'::jsonb),
    ('tdef_sandbox_read', 'tsrc_seed_demo', 'default', 'read_file',
     '读取工作目录文件内容。参数:path(相对路径,如 src/App.tsx)。',
     'sandbox', '{"op":"read_file"}'::jsonb,
     '{"type":"object","properties":{"path":{"type":"string","description":"相对路径"}},"required":["path"],"additionalProperties":false}'::jsonb,
     true, 'active', 'low', '["coding","file"]'::jsonb),
    ('tdef_sandbox_list', 'tsrc_seed_demo', 'default', 'list_files',
     '列出工作目录文件/子目录。参数:path(相对路径,默认 . 根工作目录)。',
     'sandbox', '{"op":"list_files"}'::jsonb,
     '{"type":"object","properties":{"path":{"type":"string","description":"相对路径(默认根目录)","default":"."}},"additionalProperties":false}'::jsonb,
     true, 'active', 'low', '["coding","file"]'::jsonb)
    ON CONFLICT (id) DO NOTHING
  `);
  console.log(
    '  ✓ Seed coding 工具 write_file/read_file/list_files (sandbox 执行器,路径B 真实创建应用)'
  );

  // App Catalog: 不预置 mock 数据，由用户在管理后台或 AI 创建真实轻应用

  console.log('Login credentials:');
  for (const u of data.users) {
    if (u.password) {
      console.log(`  ${u.displayName}: ${u.username} / ${u.password}`);
    }
  }

  await client.end();
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
