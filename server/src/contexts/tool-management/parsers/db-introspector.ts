/**
 * DB Introspector — 连接目标数据库，探测表结构，生成查询工具定义
 *
 * 安全约束：
 * - 仅只读操作
 * - 探测使用 information_schema（标准 SQL）
 * - 生成的查询工具执行时强制 READ ONLY
 */

import type { ParsedTool } from '../types.js';

/* ──── Types ──── */

export interface DbConnectionConfig {
  type: 'postgresql' | 'mysql';
  host: string;
  port: number;
  database: string;
  schema?: string;
  username: string;
  password: string;
}

export interface DbTableInfo {
  tableName: string;
  tableType: string; // 'BASE TABLE' | 'VIEW'
  columns: DbColumnInfo[];
}

export interface DbColumnInfo {
  name: string;
  dataType: string;
  isNullable: boolean;
  columnDefault: string | null;
  isPrimaryKey: boolean;
  comment?: string;
}

export interface IntrospectResult {
  tables: DbTableInfo[];
  errors: string[];
}

/* ──── DB Introspector ──── */

export class DbIntrospector {
  /**
   * 探测数据库表结构
   */
  async introspect(config: DbConnectionConfig): Promise<IntrospectResult> {
    if (config.type === 'postgresql') {
      return this.introspectPostgres(config);
    }
    if (config.type === 'mysql') {
      return this.introspectMysql(config);
    }
    return { tables: [], errors: [`不支持的数据库类型: ${config.type}`] };
  }

  /**
   * 测试数据库连接(按 config.type 分流:PG 用 pg,MySQL 用 mysql2)
   */
  async testConnection(config: DbConnectionConfig): Promise<{ success: boolean; message: string }> {
    try {
      if (config.type === 'mysql') {
        const mysql = await import('mysql2/promise');
        const conn = await mysql.createConnection({
          host: config.host,
          port: config.port,
          database: config.database,
          user: config.username,
          password: config.password,
          connectTimeout: 5000,
        });
        await conn.execute('SELECT 1');
        await conn.end();
        return { success: true, message: '连接成功' };
      }
      // 默认 PostgreSQL
      const { default: pg } = await import('pg');
      const client = new pg.Client({
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.username,
        password: config.password,
        connectionTimeoutMillis: 5000,
      });
      await client.connect();
      await client.query('SELECT 1');
      await client.end();
      return { success: true, message: '连接成功' };
    } catch (err) {
      return {
        success: false,
        message: `连接失败: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  /**
   * 将探测到的表结构转换为工具定义
   */
  generateTools(tables: DbTableInfo[], config: DbConnectionConfig): ParsedTool[] {
    const tools: ParsedTool[] = [];

    for (const table of tables) {
      // query_{table} — 带条件的 SELECT
      tools.push(this.buildQueryTool(table, config));
      // count_{table} — COUNT
      tools.push(this.buildCountTool(table, config));
    }

    return tools;
  }

  /* ──── PostgreSQL Introspection ──── */

  private async introspectPostgres(config: DbConnectionConfig): Promise<IntrospectResult> {
    const errors: string[] = [];
    const schemaName = config.schema || 'public';

    try {
      const { default: pg } = await import('pg');
      const client = new pg.Client({
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.username,
        password: config.password,
        connectionTimeoutMillis: 10000,
      });
      await client.connect();

      // 设置只读事务
      await client.query('SET TRANSACTION READ ONLY');

      // 获取表列表
      const tablesResult = await client.query(
        `SELECT table_name, table_type
         FROM information_schema.tables
         WHERE table_schema = $1
           AND table_type IN ('BASE TABLE', 'VIEW')
         ORDER BY table_name`,
        [schemaName]
      );

      // 获取列信息
      const columnsResult = await client.query(
        `SELECT table_name, column_name, data_type, is_nullable, column_default
         FROM information_schema.columns
         WHERE table_schema = $1
         ORDER BY table_name, ordinal_position`,
        [schemaName]
      );

      // 获取主键信息
      const pkResult = await client.query(
        `SELECT kcu.table_name, kcu.column_name
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu
           ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
         WHERE tc.constraint_type = 'PRIMARY KEY'
           AND tc.table_schema = $1`,
        [schemaName]
      );

      await client.end();

      // 组装数据
      const pkMap = new Map<string, Set<string>>();
      for (const row of pkResult.rows as { table_name: string; column_name: string }[]) {
        let pkCols = pkMap.get(row.table_name);
        if (!pkCols) {
          pkCols = new Set();
          pkMap.set(row.table_name, pkCols);
        }
        pkCols.add(row.column_name);
      }

      const columnMap = new Map<string, DbColumnInfo[]>();
      for (const row of columnsResult.rows as {
        table_name: string;
        column_name: string;
        data_type: string;
        is_nullable: string;
        column_default: string | null;
      }[]) {
        let cols = columnMap.get(row.table_name);
        if (!cols) {
          cols = [];
          columnMap.set(row.table_name, cols);
        }
        const pks = pkMap.get(row.table_name);
        cols.push({
          name: row.column_name,
          dataType: row.data_type,
          isNullable: row.is_nullable === 'YES',
          columnDefault: row.column_default,
          isPrimaryKey: pks?.has(row.column_name) ?? false,
        });
      }

      const tables: DbTableInfo[] = (
        tablesResult.rows as { table_name: string; table_type: string }[]
      ).map((row) => ({
        tableName: row.table_name,
        tableType: row.table_type,
        columns: columnMap.get(row.table_name) ?? [],
      }));

      return { tables, errors };
    } catch (err) {
      errors.push(`PostgreSQL 探测失败: ${err instanceof Error ? err.message : String(err)}`);
      return { tables: [], errors };
    }
  }

  /* ──── MySQL Introspection ──── */

  private async introspectMysql(config: DbConnectionConfig): Promise<IntrospectResult> {
    const errors: string[] = [];
    const schemaName = config.schema || config.database; // MySQL 用库名作 schema 限定

    try {
      const mysql = await import('mysql2/promise');
      const conn = await mysql.createConnection({
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.username,
        password: config.password,
        connectTimeout: 10000,
      });

      // MySQL 只读会话(防 SET TRANSACTION READ ONLY 在非事务上下文的差异,用 START TRANSACTION READ ONLY)
      await conn.query('START TRANSACTION READ ONLY');

      // 表列表(MySQL information_schema.table_schema 即库名)
      const [tablesRows] = (await conn.execute(
        `SELECT TABLE_NAME AS table_name, TABLE_TYPE AS table_type
         FROM information_schema.tables
         WHERE table_schema = ?
           AND TABLE_TYPE IN ('BASE TABLE', 'VIEW')
         ORDER BY table_name`,
        [schemaName]
      )) as [unknown[], unknown];

      // 列信息
      const [columnsRows] = (await conn.execute(
        `SELECT TABLE_NAME AS table_name, COLUMN_NAME AS column_name,
                DATA_TYPE AS data_type, IS_NULLABLE AS is_nullable,
                COLUMN_DEFAULT AS column_default, COLUMN_COMMENT AS column_comment
         FROM information_schema.columns
         WHERE table_schema = ?
         ORDER BY table_name, ORDINAL_POSITION`,
        [schemaName]
      )) as [unknown[], unknown];

      // 主键(MySQL 用 statistics 表,非 table_constraints)
      const [pkRows] = (await conn.execute(
        `SELECT TABLE_NAME AS table_name, COLUMN_NAME AS column_name
         FROM information_schema.statistics
         WHERE table_schema = ? AND INDEX_NAME = 'PRIMARY'`,
        [schemaName]
      )) as [unknown[], unknown];

      await conn.end();

      const pkMap = new Map<string, Set<string>>();
      for (const row of pkRows as { table_name: string; column_name: string }[]) {
        let pkCols = pkMap.get(row.table_name);
        if (!pkCols) {
          pkCols = new Set();
          pkMap.set(row.table_name, pkCols);
        }
        pkCols.add(row.column_name);
      }

      const columnMap = new Map<string, DbColumnInfo[]>();
      for (const row of columnsRows as {
        table_name: string;
        column_name: string;
        data_type: string;
        is_nullable: string;
        column_default: string | null;
        column_comment: string;
      }[]) {
        let cols = columnMap.get(row.table_name);
        if (!cols) {
          cols = [];
          columnMap.set(row.table_name, cols);
        }
        const pks = pkMap.get(row.table_name);
        cols.push({
          name: row.column_name,
          dataType: row.data_type,
          isNullable: row.is_nullable === 'YES',
          columnDefault: row.column_default,
          isPrimaryKey: pks?.has(row.column_name) ?? false,
          comment: row.column_comment || undefined,
        });
      }

      const tables: DbTableInfo[] = (
        tablesRows as { table_name: string; table_type: string }[]
      ).map((row) => ({
        tableName: row.table_name,
        tableType: row.table_type,
        columns: columnMap.get(row.table_name) ?? [],
      }));

      return { tables, errors };
    } catch (err) {
      errors.push(`MySQL 探测失败: ${err instanceof Error ? err.message : String(err)}`);
      return { tables: [], errors };
    }
  }

  /* ──── Tool Generation ──── */

  private buildQueryTool(table: DbTableInfo, config: DbConnectionConfig): ParsedTool {
    const filterableColumns = table.columns.filter(
      (c) => !['jsonb', 'json', 'bytea', 'text'].includes(c.dataType)
    );

    const properties: Record<string, unknown> = {
      limit: { type: 'integer', description: '返回行数限制 (max 100)', default: 20 },
      offset: { type: 'integer', description: '偏移量', default: 0 },
    };

    for (const col of filterableColumns.slice(0, 10)) {
      properties[col.name] = {
        type: this.mapDbTypeToJsonType(col.dataType),
        description: `按 ${col.name} 筛选 (${col.dataType})`,
      };
    }

    return {
      name: `query_${table.tableName}`,
      summary: `查询 ${table.tableName} 表数据`,
      description: `从 ${table.tableName} (${table.tableType}) 中查询数据，支持条件筛选和分页。列: ${table.columns.map((c) => c.name).join(', ')}`,
      executionType: 'db_query',
      executionConfig: {
        host: config.host,
        port: config.port,
        database: config.database,
        schema: config.schema || 'public',
        table: table.tableName,
        operation: 'select',
        maxRows: 100,
      },
      inputSchema: {
        type: 'object',
        properties,
      },
      tags: ['database', table.tableName],
    };
  }

  private buildCountTool(table: DbTableInfo, config: DbConnectionConfig): ParsedTool {
    const filterableColumns = table.columns.filter(
      (c) => !['jsonb', 'json', 'bytea', 'text'].includes(c.dataType)
    );

    const properties: Record<string, unknown> = {};
    for (const col of filterableColumns.slice(0, 5)) {
      properties[col.name] = {
        type: this.mapDbTypeToJsonType(col.dataType),
        description: `按 ${col.name} 筛选`,
      };
    }

    return {
      name: `count_${table.tableName}`,
      summary: `统计 ${table.tableName} 表行数`,
      description: `统计 ${table.tableName} 中满足条件的行数`,
      executionType: 'db_query',
      executionConfig: {
        host: config.host,
        port: config.port,
        database: config.database,
        schema: config.schema || 'public',
        table: table.tableName,
        operation: 'count',
      },
      inputSchema: Object.keys(properties).length > 0 ? { type: 'object', properties } : {},
      tags: ['database', table.tableName, 'count'],
    };
  }

  private mapDbTypeToJsonType(dbType: string): string {
    const intTypes = ['integer', 'bigint', 'smallint', 'int', 'serial'];
    const numTypes = ['numeric', 'decimal', 'real', 'double precision', 'float'];
    const boolTypes = ['boolean', 'bool'];

    if (intTypes.includes(dbType)) return 'integer';
    if (numTypes.includes(dbType)) return 'number';
    if (boolTypes.includes(dbType)) return 'boolean';
    return 'string';
  }
}
