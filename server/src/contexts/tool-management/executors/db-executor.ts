/**
 * DB Executor — 执行数据库查询工具调用
 *
 * 安全约束：
 * - 强制 READ ONLY 事务
 * - 参数化查询（防 SQL 注入）
 * - 行数限制（最多 100 行）
 * - 超时控制
 */

import type { IToolExecutor, ExecutionResult, DecryptedCredential } from '../types.js';

const MAX_ROWS = 100;
const QUERY_TIMEOUT_MS = 10_000;

export class DbExecutor implements IToolExecutor {
  async execute(
    config: Record<string, unknown>,
    params: Record<string, unknown>,
    credential?: DecryptedCredential
  ): Promise<ExecutionResult> {
    const start = Date.now();

    const host = String(config.host || 'localhost');
    const port = Number(config.port || 5432);
    const database = String(config.database || '');
    const schema = String(config.schema || 'public');
    const table = String(config.table || '');
    const operation = String(config.operation || 'select');

    if (!database || !table) {
      return { success: false, error: '缺少 database 或 table 配置', durationMs: 0 };
    }

    if (!credential?.username) {
      return { success: false, error: '缺少数据库凭证', durationMs: 0 };
    }

    try {
      const { default: pg } = await import('pg');
      const client = new pg.Client({
        host,
        port,
        database,
        user: credential.username,
        password: credential.password || '',
        connectionTimeoutMillis: 5000,
        statement_timeout: QUERY_TIMEOUT_MS,
      });

      await client.connect();

      try {
        // 连接级只读：pg.Client 默认 autocommit，SET TRANSACTION READ ONLY 只作用于
        // 当前（自动提交的）语句、不绑定后续事务，只读约束实际失效。
        // SET default_transaction_read_only = on 使该连接的每个事务都强制 READ ONLY。
        await client.query('SET default_transaction_read_only = on');

        let result: { rows: unknown[]; rowCount: number | null };

        if (operation === 'count') {
          result = await this.executeCount(client, schema, table, params);
        } else {
          result = await this.executeSelect(client, schema, table, params);
        }

        const durationMs = Date.now() - start;
        return {
          success: true,
          data: {
            rows: result.rows,
            rowCount: result.rowCount,
          },
          durationMs,
        };
      } finally {
        await client.end();
      }
    } catch (err) {
      return {
        success: false,
        error: `数据库查询失败: ${err instanceof Error ? err.message : String(err)}`,
        durationMs: Date.now() - start,
      };
    }
  }

  private async executeSelect(
    client: {
      query(
        text: string,
        values?: unknown[]
      ): Promise<{ rows: unknown[]; rowCount: number | null }>;
    },
    schema: string,
    table: string,
    params: Record<string, unknown>
  ): Promise<{ rows: unknown[]; rowCount: number | null }> {
    const limit = Math.min(Number(params.limit) || 20, MAX_ROWS);
    const offset = Math.max(Number(params.offset) || 0, 0);

    // 构建 WHERE 条件（参数化）
    const { conditions, values } = this.buildWhereClause(params, ['limit', 'offset']);

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `SELECT * FROM "${schema}"."${this.sanitizeIdentifier(table)}" ${whereClause} LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;

    return client.query(sql, [...values, limit, offset]);
  }

  private async executeCount(
    client: {
      query(
        text: string,
        values?: unknown[]
      ): Promise<{ rows: unknown[]; rowCount: number | null }>;
    },
    schema: string,
    table: string,
    params: Record<string, unknown>
  ): Promise<{ rows: unknown[]; rowCount: number | null }> {
    const { conditions, values } = this.buildWhereClause(params, []);
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `SELECT count(*) as total FROM "${schema}"."${this.sanitizeIdentifier(table)}" ${whereClause}`;

    return client.query(sql, values);
  }

  private buildWhereClause(
    params: Record<string, unknown>,
    exclude: string[]
  ): { conditions: string[]; values: unknown[] } {
    const conditions: string[] = [];
    const values: unknown[] = [];
    const excludeSet = new Set(exclude);

    for (const [key, value] of Object.entries(params)) {
      if (excludeSet.has(key) || value === undefined || value === null || value === '') continue;
      const sanitizedKey = this.sanitizeIdentifier(key);
      values.push(value);
      conditions.push(`"${sanitizedKey}" = $${values.length}`);
    }

    return { conditions, values };
  }

  /**
   * 防止 SQL 注入的标识符清理
   * 只允许字母、数字、下划线
   */
  private sanitizeIdentifier(name: string): string {
    return name.replace(/[^a-zA-Z0-9_]/g, '');
  }
}
