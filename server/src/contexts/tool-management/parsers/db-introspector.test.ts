import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DbIntrospector } from './db-introspector.js';

// mock mysql2/promise 与 pg(探测真实 DB 不在单测范围,验逻辑分流+SQL 构造)
vi.mock('mysql2/promise', () => ({
  createConnection: vi.fn(),
}));
vi.mock('pg', () => ({
  default: { Client: vi.fn() },
}));

const pgConfig = {
  type: 'postgresql' as const,
  host: 'localhost',
  port: 5432,
  database: 'test',
  schema: 'public',
  username: 'u',
  password: 'p',
};

const mysqlConfig = {
  type: 'mysql' as const,
  host: 'localhost',
  port: 3306,
  database: 'test',
  schema: 'test',
  username: 'u',
  password: 'p',
};

describe('DbIntrospector introspect', () => {
  beforeEach(() => vi.clearAllMocks());

  it('postgresql → 调 introspectPostgres(pg)', async () => {
    const pg = (await import('pg')).default as { Client: ReturnType<typeof vi.fn> };
    const query = vi
      .fn()
      // SET TRANSACTION READ ONLY(首次调用)
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ table_name: 'users', table_type: 'BASE TABLE' }] })
      .mockResolvedValueOnce({
        rows: [
          {
            table_name: 'users',
            column_name: 'id',
            data_type: 'integer',
            is_nullable: 'NO',
            column_default: null,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ table_name: 'users', column_name: 'id' }] });
    pg.Client.mockImplementation(() => ({
      connect: vi.fn(),
      query,
      end: vi.fn(),
    }));

    const insp = new DbIntrospector();
    const result = await insp.introspect(pgConfig);

    expect(result.tables).toHaveLength(1);
    expect(result.tables[0].tableName).toBe('users');
    expect(result.tables[0].columns[0].isPrimaryKey).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('mysql → 调 introspectMysql(mysql2),不再返"未实现"', async () => {
    const mysql = (await import('mysql2/promise')) as {
      createConnection: ReturnType<typeof vi.fn>;
    };
    const execute = vi
      .fn()
      .mockResolvedValueOnce([[{ table_name: 'orders', table_type: 'BASE TABLE' }], []])
      .mockResolvedValueOnce([
        [
          {
            table_name: 'orders',
            column_name: 'id',
            data_type: 'int',
            is_nullable: 'NO',
            column_default: null,
            column_comment: '',
          },
        ],
        [],
      ])
      .mockResolvedValueOnce([[{ table_name: 'orders', column_name: 'id' }], []]);
    const query = vi.fn();
    mysql.createConnection.mockResolvedValue({ execute, query, end: vi.fn() });

    const insp = new DbIntrospector();
    const result = await insp.introspect(mysqlConfig);

    expect(result.tables).toHaveLength(1);
    expect(result.tables[0].tableName).toBe('orders');
    expect(result.tables[0].columns[0].isPrimaryKey).toBe(true);
    // 关键:不再返"MySQL 探测暂未实现"
    expect(result.errors).toEqual([]);
    expect(result.errors.some((e) => e.includes('未实现'))).toBe(false);
    // 走 MySQL START TRANSACTION READ ONLY(非 PG SET TRANSACTION)
    expect(query).toHaveBeenCalledWith('START TRANSACTION READ ONLY');
  });

  it('不支持的类型 → 返错误', async () => {
    const insp = new DbIntrospector();
    const result = await insp.introspect({ ...pgConfig, type: 'sqlite' as never });
    expect(result.tables).toEqual([]);
    expect(result.errors[0]).toMatch(/不支持/);
  });
});

describe('DbIntrospector testConnection 分流', () => {
  beforeEach(() => vi.clearAllMocks());

  it('mysql → 用 mysql2 连接(不再无脑 pg)', async () => {
    const mysql = (await import('mysql2/promise')) as {
      createConnection: ReturnType<typeof vi.fn>;
    };
    const execute = vi.fn().mockResolvedValue([{}, []]);
    mysql.createConnection.mockResolvedValue({ execute, end: vi.fn() });

    const insp = new DbIntrospector();
    const result = await insp.testConnection(mysqlConfig);

    expect(result.success).toBe(true);
    expect(mysql.createConnection).toHaveBeenCalled();
  });

  it('postgresql → 用 pg 连接', async () => {
    const pg = (await import('pg')).default as { Client: ReturnType<typeof vi.fn> };
    const query = vi.fn().mockResolvedValue({ rows: [] });
    pg.Client.mockImplementation(() => ({ connect: vi.fn(), query, end: vi.fn() }));

    const insp = new DbIntrospector();
    const result = await insp.testConnection(pgConfig);

    expect(result.success).toBe(true);
    expect(pg.Client).toHaveBeenCalled();
  });

  it('mysql 连接失败 → success:false + 错误消息', async () => {
    const mysql = (await import('mysql2/promise')) as {
      createConnection: ReturnType<typeof vi.fn>;
    };
    mysql.createConnection.mockRejectedValue(new Error('ECONNREFUSED'));

    const insp = new DbIntrospector();
    const result = await insp.testConnection(mysqlConfig);

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/ECONNREFUSED/);
  });
});

describe('DbIntrospector generateTools', () => {
  it('每张表生成 query_ + count_ 两个工具', () => {
    const insp = new DbIntrospector();
    const tools = insp.generateTools(
      [
        {
          tableName: 'users',
          tableType: 'BASE TABLE',
          columns: [
            {
              name: 'id',
              dataType: 'integer',
              isNullable: false,
              columnDefault: null,
              isPrimaryKey: true,
            },
          ],
        },
      ],
      pgConfig
    );
    expect(tools).toHaveLength(2);
    expect(tools.map((t) => t.name).sort()).toEqual(['count_users', 'query_users']);
  });
});
