/**
 * Gateway Discoverer — 从 API 网关（Higress/Kong/APISIX）自动发现路由
 * 将网关已注册的路由转换为工具定义
 */

import type { ParsedTool, GatewayType } from '../types.js';

/* ──── Types ──── */

export interface GatewayConfig {
  type: GatewayType;
  adminUrl: string;
  apiKey?: string;
  username?: string;
  password?: string;
}

export interface GatewayRoute {
  id: string;
  name: string;
  path: string;
  methods: string[];
  upstream: string;
  description?: string;
  tags?: string[];
  enabled: boolean;
}

export interface DiscoverResult {
  routes: GatewayRoute[];
  errors: string[];
}

/* ──── Gateway Discoverer ──── */

export class GatewayDiscoverer {
  /**
   * 从网关发现路由
   */
  async discover(config: GatewayConfig): Promise<DiscoverResult> {
    switch (config.type) {
      case 'higress':
        return this.discoverHigress(config);
      case 'kong':
        return this.discoverKong(config);
      case 'apisix':
        return this.discoverApisix(config);
      default:
        return { routes: [], errors: [`不支持的网关类型: ${config.type}`] };
    }
  }

  /**
   * 测试网关连接
   */
  async testConnection(config: GatewayConfig): Promise<{ success: boolean; message: string }> {
    try {
      const url = this.getHealthEndpoint(config);
      const headers = this.buildAuthHeaders(config);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(url, { headers, signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) return { success: true, message: '网关连接成功' };
      return { success: false, message: `网关返回 HTTP ${res.status}` };
    } catch (err) {
      return {
        success: false,
        message: `网关连接失败: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  /**
   * 将发现的路由转换为工具定义
   */
  generateTools(routes: GatewayRoute[], config: GatewayConfig): ParsedTool[] {
    return routes.filter((r) => r.enabled).map((route) => this.routeToTool(route, config));
  }

  /* ──── Higress Discovery ──── */

  private async discoverHigress(config: GatewayConfig): Promise<DiscoverResult> {
    const errors: string[] = [];
    try {
      const headers = this.buildAuthHeaders(config);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(`${config.adminUrl}/v1/routes`, {
        headers,
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) {
        return { routes: [], errors: [`Higress API 返回 HTTP ${res.status}`] };
      }

      const data = (await res.json()) as { data?: HigressRoute[] };
      const routes: GatewayRoute[] = (data.data ?? []).map((r) => ({
        id: r.name || r.id || '',
        name: r.name || r.id || 'unnamed',
        path: r.path || r.match?.path || '/',
        methods: r.methods || ['GET'],
        upstream: r.upstream || r.destination || '',
        description: r.description,
        tags: r.labels ? Object.keys(r.labels) : [],
        enabled: r.enabled !== false,
      }));

      return { routes, errors };
    } catch (err) {
      errors.push(`Higress 路由发现失败: ${err instanceof Error ? err.message : String(err)}`);
      return { routes: [], errors };
    }
  }

  /* ──── Kong Discovery ──── */

  private async discoverKong(config: GatewayConfig): Promise<DiscoverResult> {
    const errors: string[] = [];
    try {
      const headers = this.buildAuthHeaders(config);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(`${config.adminUrl}/routes`, {
        headers,
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) {
        return { routes: [], errors: [`Kong Admin API 返回 HTTP ${res.status}`] };
      }

      const data = (await res.json()) as { data?: KongRoute[] };
      const routes: GatewayRoute[] = (data.data ?? []).map((r) => ({
        id: r.id || '',
        name: r.name || r.id || 'unnamed',
        path: (r.paths ?? [])[0] || '/',
        methods: r.methods || ['GET'],
        upstream: r.service?.host || '',
        description: r.tags?.join(', '),
        tags: r.tags,
        enabled: true,
      }));

      return { routes, errors };
    } catch (err) {
      errors.push(`Kong 路由发现失败: ${err instanceof Error ? err.message : String(err)}`);
      return { routes: [], errors };
    }
  }

  /* ──── APISIX Discovery ──── */

  private async discoverApisix(config: GatewayConfig): Promise<DiscoverResult> {
    const errors: string[] = [];
    try {
      const headers = this.buildAuthHeaders(config);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(`${config.adminUrl}/apisix/admin/routes`, {
        headers,
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) {
        return { routes: [], errors: [`APISIX Admin API 返回 HTTP ${res.status}`] };
      }

      const data = (await res.json()) as { list?: ApisixRouteWrapper[] };
      const routes: GatewayRoute[] = (data.list ?? []).map((item) => {
        const r = item.value;
        return {
          id: r.id || '',
          name: r.name || r.id || 'unnamed',
          path: r.uri || '/',
          methods: r.methods || ['GET'],
          upstream: r.upstream?.nodes ? Object.keys(r.upstream.nodes)[0] || '' : '',
          description: r.desc,
          tags: r.labels ? Object.values(r.labels) : [],
          enabled: r.status === 1,
        };
      });

      return { routes, errors };
    } catch (err) {
      errors.push(`APISIX 路由发现失败: ${err instanceof Error ? err.message : String(err)}`);
      return { routes: [], errors };
    }
  }

  /* ──── Helpers ──── */

  private routeToTool(route: GatewayRoute, config: GatewayConfig): ParsedTool {
    const method = route.methods[0] || 'GET';
    return {
      name: `gw_${route.name.replace(/[^a-zA-Z0-9_]/g, '_')}`,
      summary: route.description || `${method} ${route.path} via ${config.type}`,
      description: `通过 ${config.type} 网关调用 ${route.upstream}${route.path}`,
      method,
      path: route.path,
      executionType: 'gateway_route',
      executionConfig: {
        gatewayUrl: config.adminUrl.replace(/\/admin.*$/, ''),
        routeId: route.id,
        upstream: route.upstream,
        path: route.path,
        method,
      },
      inputSchema: this.buildGatewayInputSchema(method),
      tags: ['gateway', config.type, ...(route.tags ?? [])],
      authMethod: 'none',
    };
  }

  private buildGatewayInputSchema(method: string): Record<string, unknown> {
    const properties: Record<string, unknown> = {};

    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      properties['body'] = { type: 'object', description: '请求体 (JSON)' };
    }
    properties['query'] = { type: 'object', description: '查询参数' };
    properties['headers'] = { type: 'object', description: '自定义请求头' };

    return { type: 'object', properties };
  }

  private buildAuthHeaders(config: GatewayConfig): Record<string, string> {
    const headers: Record<string, string> = {};
    if (config.apiKey) {
      headers['X-API-Key'] = config.apiKey;
    }
    if (config.username && config.password) {
      headers['Authorization'] =
        'Basic ' + Buffer.from(`${config.username}:${config.password}`).toString('base64');
    }
    return headers;
  }

  private getHealthEndpoint(config: GatewayConfig): string {
    switch (config.type) {
      case 'higress':
        return `${config.adminUrl}/v1/routes`;
      case 'kong':
        return `${config.adminUrl}/status`;
      case 'apisix':
        return `${config.adminUrl}/apisix/admin/routes`;
      default:
        return `${config.adminUrl}/health`;
    }
  }
}

/* ──── Gateway-specific response types (internal) ──── */

interface HigressRoute {
  id?: string;
  name?: string;
  path?: string;
  match?: { path?: string };
  methods?: string[];
  upstream?: string;
  destination?: string;
  description?: string;
  labels?: Record<string, string>;
  enabled?: boolean;
}

interface KongRoute {
  id?: string;
  name?: string;
  paths?: string[];
  methods?: string[];
  service?: { host?: string };
  tags?: string[];
}

interface ApisixRouteWrapper {
  value: {
    id?: string;
    name?: string;
    uri?: string;
    methods?: string[];
    upstream?: { nodes?: Record<string, number> };
    desc?: string;
    labels?: Record<string, string>;
    status?: number;
  };
}
