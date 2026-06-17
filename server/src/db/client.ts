import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.js';
import { config } from '../config/index.js';

const queryClient = postgres(config.db.url, {
  max: config.db.maxConnections,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(queryClient, { schema });
export const pool = queryClient;
export type Database = typeof db;
