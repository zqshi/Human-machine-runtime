/**
 * MatrixBot 所需的窄契约适配器与 logger。
 *
 * 从 `bootstrap.ts` 拆出。MatrixBot 期望的 IInstanceService / IDocumentService 是其自有
 * 窄契约(InstanceRow),与 domain InstanceService 返回的 Instance 存在结构性差异:
 *   - Instance.matrixRoomId 为 `string | null`,InstanceRow.matrixRoomId 为 `string | undefined`
 *   - Instance.runtime 为 `Record<string, unknown>`,InstanceRow.runtime 为 `{ endpoint?: string }`
 * 此处用显式适配器把 domain service 适配为 MatrixBot 所需接口,消除原先 `as never`
 * 的类型逃逸。运行时行为保持不变(MatrixBot 实际只读取 id/name/state/matrixRoomId/
 * runtime.endpoint 字段)。
 */
import type { InstanceService } from '../../contexts/tenant-instance/instance-service.js';
import type { Instance } from '../../contexts/tenant-instance/domain/instance.js';
import type { DocumentService } from '../../contexts/document/document-service.js';
import type { KnowledgeService } from '../../contexts/knowledge/knowledge-service.js';
import type {
  IInstanceService,
  IDocumentService,
  InstanceRow,
} from '../../integrations/matrix/matrix-bot-types.js';
import type { AuditService } from '../../contexts/audit-observability/audit-service.js';
import type { logger } from '../logger.js';

export interface MatrixLogger {
  info: (msg: string, meta?: Record<string, unknown>) => void;
  warn: (msg: string, meta?: Record<string, unknown>) => void;
  error: (msg: string, meta?: Record<string, unknown>) => void;
}

export function createMatrixBotLogger(log: typeof logger): MatrixLogger {
  return {
    info: (msg, meta) => log.info(meta ?? {}, `[MatrixBot] ${msg}`),
    warn: (msg, meta) => log.warn(meta ?? {}, `[MatrixBot] ${msg}`),
    error: (msg, meta) => log.error(meta ?? {}, `[MatrixBot] ${msg}`),
  };
}

function toInstanceRow(inst: Instance): InstanceRow {
  return {
    id: inst.id,
    name: inst.name,
    state: inst.state,
    matrixRoomId: inst.matrixRoomId ?? undefined,
    runtime: {
      endpoint: typeof inst.runtime?.endpoint === 'string' ? inst.runtime.endpoint : undefined,
    },
  };
}

export function createMatrixInstanceAdapter(instanceService: InstanceService): IInstanceService {
  return {
    list: async (tenantId?: string, resourceSource?: string) =>
      (await instanceService.list(tenantId, resourceSource)).map(toInstanceRow),
    get: async (id: string) => toInstanceRow(await instanceService.get(id)),
    start: async (id: string) => toInstanceRow(await instanceService.start(id)),
    stop: async (id: string) => toInstanceRow(await instanceService.stop(id)),
    async createFromMatrix() {
      throw new Error(
        'createFromMatrix via MatrixBot is not wired to InstanceService; use the control-plane HTTP endpoint instead'
      );
    },
    buildMatrixCard() {
      throw new Error(
        'buildMatrixCard via MatrixBot is not wired to InstanceService; use the control-plane HTTP endpoint instead'
      );
    },
  };
}

export function createMatrixDocumentAdapter(documentService: DocumentService): IDocumentService {
  return {
    create: async (params) => {
      const doc = await documentService.create({
        title: params.title,
        roomId: params.roomId,
        type: params.type,
        createdBy: params.createdBy,
        content: params.content,
      });
      return { id: doc.id, title: doc.title };
    },
    get: async (id: string) => {
      const doc = await documentService.get(id);
      return {
        id: doc.id,
        title: doc.title,
        type: doc.type,
        content: doc.content,
      };
    },
  };
}

export interface MatrixBotDeps {
  matrixInstanceAdapter: IInstanceService;
  matrixDocumentAdapter: IDocumentService;
  auditService: AuditService;
  knowledgeService: KnowledgeService | null;
}

export function createMatrixBotDeps(params: {
  instanceService: InstanceService;
  documentService: DocumentService;
  auditService: AuditService;
  knowledgeService: KnowledgeService | null;
}): MatrixBotDeps {
  const matrixInstanceAdapter = createMatrixInstanceAdapter(params.instanceService);
  const matrixDocumentAdapter = createMatrixDocumentAdapter(params.documentService);
  return {
    matrixInstanceAdapter,
    matrixDocumentAdapter,
    auditService: params.auditService,
    knowledgeService: params.knowledgeService,
  };
}
