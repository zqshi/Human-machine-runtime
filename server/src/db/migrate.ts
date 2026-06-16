import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.js';
import { config } from '../config/index.js';
import { migrateIdentity } from './migrations/identity.js';
import { migrateTenant } from './migrations/tenant.js';
import { migrateAiGateway } from './migrations/ai-gateway.js';
import { migrateOperational } from './migrations/operational.js';
import { migrateSharedAssets } from './migrations/shared-assets.js';
import { migrateObservability } from './migrations/observability.js';
import { migratePlan } from './migrations/plan.js';
import { migrateToolRegistry } from './migrations/tool-registry.js';
import { migrateEvalBenchmark } from './migrations/eval-benchmark.js';
import { migrateDepartment } from './migrations/department.js';
import { migrateEmployeeMemoryScope } from './migrations/employee-memory-scope.js';
import { migrateScheduledTasks } from './migrations/scheduled-tasks.js';

async function runMigrations() {
  const client = postgres(config.db.url, { max: 1 });
  const db = drizzle(client, { schema });

  console.log('Syncing database schema (auto-create tables)...');

  await migrateIdentity(db);
  await migrateTenant(db);
  await migrateAiGateway(db);
  await migrateOperational(db);
  await migrateSharedAssets(db);
  await migrateObservability(db);
  await migratePlan(db);
  await migrateToolRegistry(db);
  await migrateEvalBenchmark(db);
  await migrateDepartment(db);
  await migrateEmployeeMemoryScope(db);
  await migrateScheduledTasks(db);

  console.log('Schema sync complete — all tables created.');
  await client.end();
  process.exit(0);
}

runMigrations().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
