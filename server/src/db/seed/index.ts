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

  // ──── Default Roles seed ────
  await db.execute(sql`
    INSERT INTO user_roles (name, display_name, permissions)
    VALUES ('platform_admin', '平台管理员', ${JSON.stringify(['*'])}::jsonb)
    ON CONFLICT (name) DO NOTHING
  `);
  console.log('  ✓ Default role "platform_admin" ensured');

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
