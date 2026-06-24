import type { AgentFramework } from '../sandbox/agent-runtime-adapter.js';
import type { AgentRuntimeType } from './agent-definition.js';

/**
 * RuntimeRegistry — 运行时声明态 → adapter 映射(治本 D8 后端侧)。
 *
 * AgentDefinition.spec.runtime.runtimeType 是声明态值(claude/openclaw/hermes),
 * adapter 注册用 AgentFramework(claude-agent-sdk/openclaw/dify/...)。
 * 本 registry 做映射:声明态 runtimeType → 实际 AgentFramework adapter,
 * 让 AgentDefinition 声明的运行时可替换(hemes 等),不与具体 adapter 实现硬绑。
 *
 * 纯逻辑(domain,零外部依赖):mapRuntimeType + SandboxTemplate 定义查询。
 */
export interface SandboxTemplateDef {
  /** 模板名(与 AgentDefinitionSpec.sandboxTemplate 对齐) */
  name: string;
  /** 描述 */
  description: string;
  /** CPU 限额(K8s 风格 '1000m' = 1 核),docker-worker-runner 转 --cpus */
  cpu: string;
  /** 内存限额(K8s 风格 '512Mi'),docker-worker-runner 转 --memory */
  memory: string;
  /** 网络模式:bridge(默认隔离)/ host / none */
  networkMode: 'bridge' | 'host' | 'none';
  /** 是否高权限(cap_add;high-privilege 模板才放开) */
  highPrivilege: boolean;
}

/** 内置 sandbox 模板(与 docker-worker-runner.ts 的隔离策略对齐) */
export const BUILTIN_SANDBOX_TEMPLATES: SandboxTemplateDef[] = [
  {
    name: 'basic',
    description: '基础沙箱:网络隔离 + 最小权限,默认选择',
    cpu: '1000m',
    memory: '512Mi',
    networkMode: 'bridge',
    highPrivilege: false,
  },
  {
    name: 'high-privilege',
    description: '高权限沙箱:放开 cap_add(需明示声明,审计留痕)',
    cpu: '2000m',
    memory: '2Gi',
    networkMode: 'bridge',
    highPrivilege: true,
  },
  {
    name: 'network-isolated',
    description: '网络全隔离沙箱:无网络访问(纯计算任务)',
    cpu: '1000m',
    memory: '512Mi',
    networkMode: 'none',
    highPrivilege: false,
  },
];

export const DEFAULT_SANDBOX_TEMPLATE = 'basic';

/**
 * 声明态 runtimeType → AgentFramework adapter 映射。
 * 治本 D8:声明态用语义值,adapter 注册用框架名,二者解耦。
 */
const RUNTIME_TYPE_TO_FRAMEWORK: Record<AgentRuntimeType, AgentFramework> = {
  claude: 'claude-agent-sdk',
  openclaw: 'openclaw',
  hermes: 'custom', // hermes 走 custom adapter(待 hermes adapter 实现后改)
};

export class RuntimeRegistry {
  /** 声明态 runtimeType → AgentFramework */
  mapRuntimeType(runtimeType: AgentRuntimeType): AgentFramework {
    return RUNTIME_TYPE_TO_FRAMEWORK[runtimeType] ?? 'custom';
  }

  /** 查询 sandbox 模板定义(管理后台展示) */
  getSandboxTemplate(name: string): SandboxTemplateDef | null {
    return BUILTIN_SANDBOX_TEMPLATES.find((t) => t.name === name) ?? null;
  }

  /** 列出全部 sandbox 模板 */
  listSandboxTemplates(): SandboxTemplateDef[] {
    return [...BUILTIN_SANDBOX_TEMPLATES];
  }

  /** 校验 sandbox 模板名是否合法(供 AgentDefinition spec 校验复用) */
  isValidSandboxTemplate(name: string): boolean {
    return BUILTIN_SANDBOX_TEMPLATES.some((t) => t.name === name);
  }
}
