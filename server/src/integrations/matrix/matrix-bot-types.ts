export interface IInstanceService {
  list(): Promise<InstanceRow[]>;
  get(id: string): Promise<InstanceRow>;
  createFromMatrix(params: CreateFromMatrixParams): Promise<InstanceRow>;
  buildMatrixCard(instance: InstanceRow): MatrixCard;
  start(id: string): Promise<InstanceRow>;
  stop(id: string): Promise<InstanceRow>;
  getProvisioningJob?(requestId: string): Promise<ProvisioningJob>;
}

export interface IRuntimeProxyService {
  invoke(instanceId: string, payload: InvokePayload): Promise<InvokeResult>;
}

export interface IDocumentService {
  create(params: {
    title: string;
    roomId: string;
    type: string;
    createdBy: string;
    content: { html: string };
  }): Promise<{ id: string; title: string }>;
  get(
    id: string
  ): Promise<{ id: string; title: string; type: string; content: Record<string, unknown> }>;
}

export interface IWeKnoraService {
  query(
    question: string,
    tenantId?: string,
    kbIds?: string[]
  ): Promise<{
    answer: string;
    sources: { id?: string; title?: string; content?: string; score?: number }[];
  }>;
  search(
    keyword: string,
    tenantId?: string,
    kbIds?: string[]
  ): Promise<{ title?: string; content?: string; score?: number }[]>;
}

export interface IAuditService {
  log(type: string, payload?: Record<string, unknown>): Promise<void>;
}

export interface InstanceRow {
  id: string;
  name: string;
  state: string;
  matrixRoomId?: string;
  runtime: { endpoint?: string };
}

export interface CreateFromMatrixParams {
  name: string;
  creator: string;
  matrixRoomId: string;
  requestId: string;
  employeeProfile: EmployeeProfile;
}

export interface MatrixCard {
  instanceId?: string;
  matrixRoomId?: string;
  chatUrl?: string;
  actions?: { type: string; url?: string }[];
}

export interface ProvisioningJob {
  status?: string;
  phase?: string;
  instanceId?: string;
  attempts?: number;
  error?: string;
}

export interface InvokePayload {
  input: string;
  source: string;
  sender: string;
  roomId: string;
  channel: string;
}

export interface InvokeResult {
  mode?: string;
  response?: Record<string, unknown>;
}

export interface EmployeeProfile {
  email: string;
  jobTitle: string;
  jobCode: string;
  department: string;
  employeeNo?: string;
  employeeId?: string;
  enterpriseUserId?: string;
}

export interface StatusInput {
  action: string;
  phase: string;
  traceId?: string;
  message?: string;
  instanceId?: string;
  roomId?: string;
  chatUrl?: string;
  requestId?: string;
}

export interface BotResult {
  ignored: boolean;
  reply?: string;
  card?: MatrixCard;
  phase?: string;
  traceId?: string;
  drawerContent?: DrawerContent;
  delegated?: boolean;
  data?: unknown;
}

export interface DrawerContent {
  type: string;
  title: string;
  data: Record<string, unknown>;
}

export interface MatrixBotConfig {
  matrixAccessToken?: string;
  matrixUserId?: string;
  matrixConversationMode?: string;
}

export interface MatrixBotDeps {
  runtimeProxyService?: IRuntimeProxyService;
  resolveIdentityProfile?: (sender: string) => Promise<Partial<EmployeeProfile> | null>;
  auditService?: IAuditService;
  documentService?: IDocumentService;
  weKnoraService?: IWeKnoraService;
}

export interface Logger {
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
}

export interface BotContext {
  instanceService: IInstanceService;
  runtimeProxyService: IRuntimeProxyService | null;
  documentService: IDocumentService | null;
  weKnoraService: IWeKnoraService | null;
  auditService: IAuditService | null;
  logger: Logger;
  ragCooldowns: Map<string, number>;
  resolveTenantId?(roomId: string): Promise<string | null>;
  renderStatusMessage(input: Partial<StatusInput>): string;
  renderCardMessage(card: MatrixCard, traceId: string): string;
  audit(type: string, payload?: Record<string, unknown>): Promise<void>;
  buildProvisionRequestId(params: {
    roomId?: string;
    sender?: string;
    name?: string;
    eventId?: string;
  }): string;
  buildCreatorProfile(sender: string, intent?: { jobTitle?: string }): Promise<EmployeeProfile>;
}
