/**
 * OpenAPI Parser — 解析 OpenAPI 3.x / Swagger 2.0 规范文档
 *
 * 将 spec 中的每个 operation 转换为一个 ParsedTool。
 * 不引入重量级第三方库，手写解析（OAS 结构简洁可控）。
 */

import type { ParsedTool, AuthMethod } from '../types.js';

/* ──── Internal Types ──── */

interface OasParameter {
  name: string;
  in: string;
  description?: string;
  required?: boolean;
  schema?: Record<string, unknown>;
  type?: string; // Swagger 2.0
}

interface OasOperation {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: OasParameter[];
  requestBody?: {
    description?: string;
    required?: boolean;
    content?: Record<string, { schema?: Record<string, unknown> }>;
  };
  responses?: Record<
    string,
    { description?: string; content?: Record<string, { schema?: Record<string, unknown> }> }
  >;
  security?: Record<string, string[]>[];
}

interface OasSpec {
  openapi?: string;
  swagger?: string;
  info?: { title?: string; version?: string; description?: string };
  host?: string; // Swagger 2.0
  basePath?: string; // Swagger 2.0
  servers?: { url: string }[];
  paths?: Record<string, Record<string, OasOperation>>;
  securityDefinitions?: Record<string, { type: string; in?: string; name?: string }>;
  components?: {
    securitySchemes?: Record<string, { type: string; scheme?: string; in?: string; name?: string }>;
    schemas?: Record<string, Record<string, unknown>>;
  };
}

/* ──── Public API ──── */

export interface OpenApiParseResult {
  tools: ParsedTool[];
  specVersion: string;
  title: string;
  baseUrl: string;
  errors: string[];
}

export class OpenApiParser {
  /**
   * 解析 OpenAPI spec 字符串（JSON 或 YAML）
   * YAML 通过简单的 JSON 尝试 + fallback 处理
   */
  parse(specStr: string): OpenApiParseResult {
    const errors: string[] = [];
    let spec: OasSpec;

    try {
      spec = this.parseSpecString(specStr);
    } catch (err) {
      return {
        tools: [],
        specVersion: 'unknown',
        title: 'unknown',
        baseUrl: '',
        errors: [`spec 解析失败: ${err instanceof Error ? err.message : String(err)}`],
      };
    }

    const specVersion = spec.openapi || spec.swagger || 'unknown';
    const title = spec.info?.title || 'Untitled API';
    const baseUrl = this.resolveBaseUrl(spec);
    const authMethod = this.resolveGlobalAuth(spec);
    const tools: ParsedTool[] = [];

    if (!spec.paths) {
      return { tools, specVersion, title, baseUrl, errors: ['spec 中未找到 paths 定义'] };
    }

    const HTTP_METHODS = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options'];

    for (const [path, pathItem] of Object.entries(spec.paths)) {
      for (const [method, operation] of Object.entries(pathItem)) {
        if (!HTTP_METHODS.includes(method)) continue;
        try {
          const tool = this.operationToTool(
            path,
            method.toUpperCase(),
            operation,
            baseUrl,
            authMethod,
            spec
          );
          tools.push(tool);
        } catch (err) {
          errors.push(
            `${method.toUpperCase()} ${path}: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }
    }

    return { tools, specVersion, title, baseUrl, errors };
  }

  /**
   * 从 URL 拉取 spec 并解析
   */
  async parseFromUrl(url: string): Promise<OpenApiParseResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) {
        return {
          tools: [],
          specVersion: 'unknown',
          title: 'unknown',
          baseUrl: '',
          errors: [`从 URL 获取 spec 失败: HTTP ${res.status}`],
        };
      }
      const text = await res.text();
      return this.parse(text);
    } catch (err) {
      return {
        tools: [],
        specVersion: 'unknown',
        title: 'unknown',
        baseUrl: '',
        errors: [`从 URL 获取 spec 失败: ${err instanceof Error ? err.message : String(err)}`],
      };
    } finally {
      clearTimeout(timer);
    }
  }

  /* ──── Internals ──── */

  private parseSpecString(specStr: string): OasSpec {
    const trimmed = specStr.trim();

    // 尝试 JSON 解析
    if (trimmed.startsWith('{')) {
      return JSON.parse(trimmed) as OasSpec;
    }

    // 简单 YAML 解析 — 处理常见的 OpenAPI YAML 格式
    // 实际生产环境如果 YAML 场景复杂，可后续引入 yaml 包
    return this.parseSimpleYaml(trimmed);
  }

  /**
   * 极简 YAML → JSON 转换，覆盖 OpenAPI spec 常见结构。
   * 对于复杂 YAML（锚点/别名/多文档），返回错误提示用户提供 JSON 格式。
   */
  private parseSimpleYaml(yamlStr: string): OasSpec {
    // 移除注释
    const lines = yamlStr.split('\n').map((line) => {
      const hashIdx = line.indexOf('#');
      if (hashIdx === -1) return line;
      // 保留引号内的 #
      let inQuote = false;
      let quoteChar = '';
      for (let i = 0; i < hashIdx; i++) {
        const ch = line[i];
        if (!inQuote && (ch === '"' || ch === "'")) {
          inQuote = true;
          quoteChar = ch;
        } else if (inQuote && ch === quoteChar) {
          inQuote = false;
        }
      }
      return inQuote ? line : line.slice(0, hashIdx);
    });

    // 如果包含锚点/别名，提示用户转 JSON
    if (lines.some((l) => /[&*]\w/.test(l))) {
      throw new Error('YAML 包含锚点/别名语法，请转为 JSON 格式后上传');
    }

    // 用 indentation 构建嵌套对象
    return this.buildYamlObject(lines, 0).value as OasSpec;
  }

  private buildYamlObject(lines: string[], startIdx: number): { value: unknown; nextIdx: number } {
    const result: Record<string, unknown> = {};
    let i = startIdx;
    let baseIndent = -1;

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trimEnd();
      if (!trimmed || trimmed === '---') {
        i++;
        continue;
      }

      const indent = line.length - line.trimStart().length;

      if (baseIndent === -1) {
        baseIndent = indent;
      } else if (indent < baseIndent) {
        break;
      } else if (indent > baseIndent) {
        i++;
        continue;
      }

      const content = trimmed.trim();

      // key: value
      const colonIdx = content.indexOf(':');
      if (colonIdx === -1) {
        i++;
        continue;
      }

      const key = content.slice(0, colonIdx).trim();
      const rawValue = content.slice(colonIdx + 1).trim();

      if (rawValue === '' || rawValue === '|' || rawValue === '>') {
        // 子对象或数组
        const nextNonEmpty = this.findNextNonEmptyLine(lines, i + 1);
        if (nextNonEmpty < lines.length) {
          const nextIndent = lines[nextNonEmpty].length - lines[nextNonEmpty].trimStart().length;
          if (nextIndent > indent) {
            if (lines[nextNonEmpty].trimStart().startsWith('-')) {
              const arr = this.buildYamlArray(lines, nextNonEmpty, nextIndent);
              result[key] = arr.value;
              i = arr.nextIdx;
            } else {
              const sub = this.buildYamlObject(lines, nextNonEmpty);
              result[key] = sub.value;
              i = sub.nextIdx;
            }
          } else {
            result[key] = rawValue === '|' || rawValue === '>' ? '' : {};
            i++;
          }
        } else {
          result[key] = {};
          i++;
        }
      } else {
        result[key] = this.parseYamlValue(rawValue);
        i++;
      }
    }

    return { value: result, nextIdx: i };
  }

  private buildYamlArray(
    lines: string[],
    startIdx: number,
    baseIndent: number
  ): { value: unknown[]; nextIdx: number } {
    const result: unknown[] = [];
    let i = startIdx;

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trimEnd();
      if (!trimmed) {
        i++;
        continue;
      }

      const indent = line.length - line.trimStart().length;
      if (indent < baseIndent) break;
      if (indent > baseIndent) {
        i++;
        continue;
      }

      const content = trimmed.trim();
      if (!content.startsWith('-')) break;

      const itemValue = content.slice(1).trim();
      if (itemValue) {
        result.push(this.parseYamlValue(itemValue));
      }
      i++;
    }

    return { value: result, nextIdx: i };
  }

  private parseYamlValue(raw: string): unknown {
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    if (raw === 'null' || raw === '~') return null;
    if (/^-?\d+$/.test(raw)) return parseInt(raw, 10);
    if (/^-?\d+\.\d+$/.test(raw)) return parseFloat(raw);
    // 去除引号
    if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
      return raw.slice(1, -1);
    }
    // 内联数组 [a, b, c]
    if (raw.startsWith('[') && raw.endsWith(']')) {
      return raw
        .slice(1, -1)
        .split(',')
        .map((s) => this.parseYamlValue(s.trim()));
    }
    return raw;
  }

  private findNextNonEmptyLine(lines: string[], startIdx: number): number {
    for (let i = startIdx; i < lines.length; i++) {
      if (lines[i].trim()) return i;
    }
    return lines.length;
  }

  private operationToTool(
    path: string,
    method: string,
    op: OasOperation,
    baseUrl: string,
    globalAuth: AuthMethod,
    spec: OasSpec
  ): ParsedTool {
    const name = this.generateToolName(method, path, op.operationId);
    const inputSchema = this.buildInputSchema(op, spec);
    const outputSchema = this.extractResponseSchema(op, spec);

    return {
      name,
      operationId: op.operationId,
      method,
      path,
      summary: op.summary,
      description: op.description || op.summary,
      inputSchema,
      outputSchema,
      authMethod: globalAuth,
      executionType: 'http_proxy',
      executionConfig: {
        baseUrl,
        path,
        method,
      },
      tags: op.tags,
    };
  }

  private generateToolName(method: string, path: string, operationId?: string): string {
    if (operationId) {
      return operationId.replace(/[^a-zA-Z0-9_]/g, '_');
    }
    // GET /api/v1/users/{id} → get_api_v1_users_by_id
    const cleanPath = path
      .replace(/\{(\w+)\}/g, 'by_$1')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
    return `${method.toLowerCase()}_${cleanPath}`;
  }

  private buildInputSchema(op: OasOperation, spec: OasSpec): Record<string, unknown> {
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    // Path / Query / Header parameters
    for (const param of op.parameters ?? []) {
      const schema = param.schema || { type: param.type || 'string' };
      properties[param.name] = {
        ...this.resolveRef(schema, spec),
        description: param.description,
      };
      if (param.required) required.push(param.name);
    }

    // Request body (OAS 3.x)
    if (op.requestBody?.content) {
      const jsonContent =
        op.requestBody.content['application/json'] || Object.values(op.requestBody.content)[0];
      if (jsonContent?.schema) {
        const resolved = this.resolveRef(jsonContent.schema, spec);
        properties['body'] = {
          ...resolved,
          description: op.requestBody.description || 'Request body',
        };
        if (op.requestBody.required) required.push('body');
      }
    }

    if (Object.keys(properties).length === 0) return {};

    return {
      type: 'object',
      properties,
      ...(required.length > 0 ? { required } : {}),
    };
  }

  private extractResponseSchema(
    op: OasOperation,
    spec: OasSpec
  ): Record<string, unknown> | undefined {
    if (!op.responses) return undefined;

    // 优先取 200/201/default
    const successKey = ['200', '201', 'default'].find((k) => op.responses?.[k]);
    if (!successKey) return undefined;

    const response = op.responses[successKey];
    const jsonContent = response?.content?.['application/json'];
    if (!jsonContent?.schema) return undefined;

    return this.resolveRef(jsonContent.schema, spec);
  }

  private resolveRef(schema: Record<string, unknown>, spec: OasSpec): Record<string, unknown> {
    if (!schema.$ref || typeof schema.$ref !== 'string') return schema;

    const ref = schema.$ref as string;
    // #/components/schemas/XXX (OAS 3.x) or #/definitions/XXX (Swagger 2.0)
    const parts = ref.split('/');
    let target: unknown = spec;
    for (const part of parts) {
      if (part === '#') continue;
      target = (target as Record<string, unknown>)?.[part];
    }

    if (!target || typeof target !== 'object')
      return { type: 'object', description: `Ref: ${ref}` };
    return target as Record<string, unknown>;
  }

  private resolveBaseUrl(spec: OasSpec): string {
    // OAS 3.x
    if (spec.servers?.length) {
      return spec.servers[0].url;
    }
    // Swagger 2.0
    if (spec.host) {
      const scheme = 'https';
      return `${scheme}://${spec.host}${spec.basePath || ''}`;
    }
    return '';
  }

  private resolveGlobalAuth(spec: OasSpec): AuthMethod {
    // OAS 3.x
    const schemes = spec.components?.securitySchemes;
    if (schemes) {
      const first = Object.values(schemes)[0];
      if (first) return this.mapSecurityScheme(first);
    }
    // Swagger 2.0
    const defs = spec.securityDefinitions;
    if (defs) {
      const first = Object.values(defs)[0];
      if (first) return this.mapSecurityScheme(first);
    }
    return 'none';
  }

  private mapSecurityScheme(scheme: { type: string; scheme?: string }): AuthMethod {
    switch (scheme.type) {
      case 'apiKey':
        return 'api_key';
      case 'http':
        return scheme.scheme === 'bearer' ? 'bearer' : 'basic';
      case 'oauth2':
        return 'oauth2';
      default:
        return 'none';
    }
  }
}
