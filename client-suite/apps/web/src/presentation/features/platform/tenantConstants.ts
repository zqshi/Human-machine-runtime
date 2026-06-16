export const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-50 text-green-700',
  suspended: 'bg-red-50 text-red-600',
  archived: 'bg-gray-100 text-gray-500',
};

export const PLAN_COLORS: Record<string, string> = {
  free: 'bg-gray-100 text-gray-600',
  trial: 'bg-gray-100 text-gray-600',
  standard: 'bg-blue-50 text-blue-600',
  professional: 'bg-blue-50 text-blue-600',
  enterprise: 'bg-purple-50 text-purple-600',
};

export type Quotas = {
  maxInstances: number;
  maxConcurrentInstances: number;
  maxUsers: number;
  totalCpuMillis: number;
  totalMemoryMB: number;
  totalStorageGB: number;
  instanceCpu: string;
  instanceMemory: string;
  instanceStorage: string;
  knowledgeBaseSizeMB: number;
  tokenBudgetMonthly: number;
  tokenBudgetDaily: number;
  apiCallsDaily: number;
  rateLimitPerMinute: number;
  dataRetentionDays: number;
  maxWebhooks: number;
};

export type Features = {
  aiGateway: boolean;
  knowledgeBase: boolean;
  matrixIntegration: boolean;
  customTools: boolean;
};

export const CPU_OPTIONS = [
  { value: '250m', label: '0.25 核' },
  { value: '500m', label: '0.5 核' },
  { value: '1000m', label: '1 核' },
  { value: '2000m', label: '2 核' },
  { value: '4000m', label: '4 核' },
];
export const MEMORY_OPTIONS = [
  { value: '256Mi', label: '256 MB' },
  { value: '512Mi', label: '512 MB' },
  { value: '1Gi', label: '1 GB' },
  { value: '2Gi', label: '2 GB' },
  { value: '4Gi', label: '4 GB' },
  { value: '8Gi', label: '8 GB' },
];
export const STORAGE_OPTIONS = [
  { value: '1Gi', label: '1 GB' },
  { value: '2Gi', label: '2 GB' },
  { value: '5Gi', label: '5 GB' },
  { value: '10Gi', label: '10 GB' },
  { value: '20Gi', label: '20 GB' },
  { value: '50Gi', label: '50 GB' },
];

export const DEFAULT_FEATURES: Features = {
  aiGateway: true,
  knowledgeBase: true,
  matrixIntegration: false,
  customTools: true,
};

export const PLAN_QUOTAS: Record<string, Quotas> = {
  free: {
    maxInstances: 3,
    maxConcurrentInstances: 2,
    maxUsers: 5,
    totalCpuMillis: 1000,
    totalMemoryMB: 1024,
    totalStorageGB: 5,
    instanceCpu: '250m',
    instanceMemory: '256Mi',
    instanceStorage: '1Gi',
    knowledgeBaseSizeMB: 256,
    tokenBudgetMonthly: 100000,
    tokenBudgetDaily: 5000,
    apiCallsDaily: 1000,
    rateLimitPerMinute: 20,
    dataRetentionDays: 30,
    maxWebhooks: 2,
  },
  trial: {
    maxInstances: 3,
    maxConcurrentInstances: 2,
    maxUsers: 5,
    totalCpuMillis: 1000,
    totalMemoryMB: 1024,
    totalStorageGB: 5,
    instanceCpu: '250m',
    instanceMemory: '256Mi',
    instanceStorage: '1Gi',
    knowledgeBaseSizeMB: 256,
    tokenBudgetMonthly: 100000,
    tokenBudgetDaily: 5000,
    apiCallsDaily: 1000,
    rateLimitPerMinute: 20,
    dataRetentionDays: 30,
    maxWebhooks: 2,
  },
  standard: {
    maxInstances: 10,
    maxConcurrentInstances: 5,
    maxUsers: 50,
    totalCpuMillis: 8000,
    totalMemoryMB: 8192,
    totalStorageGB: 20,
    instanceCpu: '500m',
    instanceMemory: '512Mi',
    instanceStorage: '2Gi',
    knowledgeBaseSizeMB: 1024,
    tokenBudgetMonthly: 1000000,
    tokenBudgetDaily: 50000,
    apiCallsDaily: 10000,
    rateLimitPerMinute: 60,
    dataRetentionDays: 90,
    maxWebhooks: 10,
  },
  professional: {
    maxInstances: 20,
    maxConcurrentInstances: 10,
    maxUsers: 100,
    totalCpuMillis: 32000,
    totalMemoryMB: 32768,
    totalStorageGB: 100,
    instanceCpu: '1000m',
    instanceMemory: '1Gi',
    instanceStorage: '5Gi',
    knowledgeBaseSizeMB: 5120,
    tokenBudgetMonthly: 5000000,
    tokenBudgetDaily: 250000,
    apiCallsDaily: 50000,
    rateLimitPerMinute: 150,
    dataRetentionDays: 180,
    maxWebhooks: 25,
  },
  enterprise: {
    maxInstances: 100,
    maxConcurrentInstances: 50,
    maxUsers: 500,
    totalCpuMillis: 128000,
    totalMemoryMB: 131072,
    totalStorageGB: 500,
    instanceCpu: '1000m',
    instanceMemory: '1Gi',
    instanceStorage: '5Gi',
    knowledgeBaseSizeMB: 10240,
    tokenBudgetMonthly: 10000000,
    tokenBudgetDaily: 500000,
    apiCallsDaily: 100000,
    rateLimitPerMinute: 300,
    dataRetentionDays: 365,
    maxWebhooks: 50,
  },
};

export const CAPACITY_LABELS: Record<string, string> = {
  maxInstances: '最大实例数',
  maxConcurrentInstances: '最大并发实例数',
  maxUsers: '最大用户数',
  totalCpuMillis: 'CPU 总量 (millicores)',
  totalMemoryMB: '内存总量 (MB)',
  totalStorageGB: '存储总量 (GB)',
};

export const AI_LABELS: Record<string, string> = {
  tokenBudgetMonthly: '月 Token 预算',
  tokenBudgetDaily: '日 Token 预算',
  apiCallsDaily: '日 API 调用上限',
  rateLimitPerMinute: 'RPM（每分钟）',
};

export const DATA_LABELS: Record<string, string> = {
  knowledgeBaseSizeMB: '知识库 (MB)',
  dataRetentionDays: '数据保留 (天)',
  maxWebhooks: 'Webhook 上限',
};

export const QUOTA_LABELS: Record<string, string> = {
  ...CAPACITY_LABELS,
  ...AI_LABELS,
  ...DATA_LABELS,
};

export interface ConfigMeta {
  value: unknown;
  source: string;
  description: string;
}

export const INDUSTRY_OPTIONS = [
  { value: 'fintech', label: '金融科技' },
  { value: 'ecommerce', label: '电商零售' },
  { value: 'healthcare', label: '医疗健康' },
  { value: 'education', label: '教育培训' },
  { value: 'manufacturing', label: '制造工业' },
  { value: 'technology', label: '科技互联网' },
  { value: 'other', label: '其他' },
] as const;

export const COMPANY_SIZE_OPTIONS = [
  { value: 'startup', label: '初创 (<20人)' },
  { value: 'small', label: '小型 (20-99人)' },
  { value: 'medium', label: '中型 (100-499人)' },
  { value: 'large', label: '大型 (500-999人)' },
  { value: 'enterprise', label: '超大型 (1000+人)' },
] as const;

export type EditorTab = 'info' | 'capacity' | 'resource' | 'ai' | 'features';
