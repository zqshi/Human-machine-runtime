import type { sql as SQL } from 'drizzle-orm';

export type MigrateDb = {
  execute(query: ReturnType<typeof SQL>): Promise<unknown>;
};
