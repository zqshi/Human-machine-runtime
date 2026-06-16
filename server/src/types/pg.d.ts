declare module 'pg' {
  export class Client {
    constructor(config: {
      host?: string;
      port?: number;
      database?: string;
      user?: string;
      password?: string;
      connectionTimeoutMillis?: number;
      statement_timeout?: number;
    });
    connect(): Promise<void>;
    query(
      text: string,
      values?: unknown[]
    ): Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>;
    end(): Promise<void>;
  }
  export default { Client };
}
