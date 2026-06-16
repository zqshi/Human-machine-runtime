import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import bcrypt from 'bcryptjs';
import { sql } from 'drizzle-orm';
import { config } from '../../config/index.js';
import * as schema from '../schema/index.js';

async function seedProduction() {
  const client = postgres(config.db.url, { max: 1 });
  const db = drizzle(client, { schema });

  console.log('[seed-production] Starting production seed...');

  /* ── 1. 默认租户 ── */
  await db.execute(sql`
    INSERT INTO tenants (id, name, slug, plan, status, industry, company_size, description, quotas, features, model_access)
    VALUES (
      'default',
      'Demo Digital Employee Platform',
      'demo-platform',
      'enterprise',
      'active',
      'technology',
      'large',
      '企业级 AI 数字员工平台',
      ${JSON.stringify({
        maxInstances: 100,
        maxConcurrentInstances: 50,
        maxUsers: 500,
        tokenBudgetMonthly: 50000000,
        dataRetentionDays: 365,
      })}::jsonb,
      ${JSON.stringify({
        aiGateway: true,
        knowledgeBase: true,
        customTools: true,
      })}::jsonb,
      ${JSON.stringify({ allowedProviders: ['anthropic', 'zhipu', 'qwen'] })}::jsonb
    )
    ON CONFLICT (id) DO NOTHING
  `);
  console.log('  ✓ Default tenant ensured');

  /* ── 2. 应急管理员账号（仅 AUTH_ALLOW_LOCAL_FALLBACK=true 时有意义）── */
  const adminPassword = process.env.DCF_ADMIN_PASSWORD;
  if (adminPassword) {
    const hash = await bcrypt.hash(adminPassword, 12);
    await db.execute(sql`
      INSERT INTO users (username, password_hash, role, scope, display_name, email, source)
      VALUES ('admin', ${`bcrypt:${hash}`}, 'platform_admin', 'platform', '平台管理员', NULL, 'seed')
      ON CONFLICT (username) DO UPDATE SET password_hash = ${`bcrypt:${hash}`}, updated_at = now()
    `);
    console.log('  ✓ Admin user created/updated (password from DCF_ADMIN_PASSWORD)');
  } else {
    console.log('  ⊘ DCF_ADMIN_PASSWORD not set, skipping admin user creation');
  }

  /* ── 3. 系统配置 ── */
  const configs = [
    { key: 'platform.name', value: 'Digital Employee Platform', description: '平台名称' },
    { key: 'platform.version', value: '1.0.0', description: '平台版本' },
    { key: 'auth.sso.enabled', value: 'true', description: 'SSO 开关' },
    { key: 'auth.default_provider', value: 'platform-be-proxy', description: '默认认证方式' },
    { key: 'channel.wps.enabled', value: 'true', description: '协作通道' },
    { key: 'channel.websocket.enabled', value: 'true', description: 'WebSocket 通道' },
  ];

  for (const c of configs) {
    await db.execute(sql`
      INSERT INTO system_configs (key, value, description)
      VALUES (${c.key}, ${c.value}, ${c.description})
      ON CONFLICT (key) DO NOTHING
    `);
  }
  console.log(`  ✓ ${configs.length} system configs ensured`);

  console.log('[seed-production] Done.');
  await client.end();
  process.exit(0);
}

seedProduction().catch((err) => {
  console.error('[seed-production] Failed:', err);
  process.exit(1);
});
