import { create } from 'zustand';

export type AdminSection =
  | 'employees'
  | 'skills'
  | 'tools'
  | 'shared-agents'
  | 'ai-gateway'
  | 'ai-traces'
  | 'logs'
  | 'auth'
  | 'notifications'
  | 'data-overview'
  | 'user-analysis'
  | 'ops-weekly'
  | 'realtime-monitor'
  | 'quota-management'
  | 'eval-suites'
  | 'eval-evaluators'
  | 'eval-experiments'
  | 'eval-experiment-detail'
  | 'eval-suite-detail'
  | 'channel-admin'
  | 'employee-memory'
  | 'scheduled-tasks'
  | 'scheduled-task-detail';

export type PlatformSection =
  | 'tenants'
  | 'plans'
  | 'users'
  | 'roles'
  | 'config'
  | 'monitoring'
  | 'audit';

export type AIGatewayTab = 'models' | 'risk-rules' | 'costs';

/** 本地日期 → YYYY-MM-DD（避免 toISOString 的 UTC 偏移导致日历日错位） */
function formatDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 计算给定基准日所在自然周（周一 ~ 周日）的日期范围 */
export function computeThisWeekRange(ref: Date = new Date()): { from: string; to: string } {
  const day = ref.getDay(); // 0=周日, 1=周一 ... 6=周六
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(ref);
  monday.setDate(ref.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { from: formatDateStr(monday), to: formatDateStr(sunday) };
}

/** 计算最近 N 天（含今天）的日期范围 */
export function computeRecentDaysRange(
  days: number,
  ref: Date = new Date()
): { from: string; to: string } {
  const to = new Date(ref);
  const from = new Date(ref);
  from.setDate(ref.getDate() - days);
  return { from: formatDateStr(from), to: formatDateStr(to) };
}

/** store 初始日期范围 = 本周（周一~周日），模块加载时计算一次 */
const initialAiGatewayWeek = computeThisWeekRange();

interface AdminState {
  currentSection: AdminSection;
  platformSection: PlatformSection;
  aiGatewayTab: AIGatewayTab;
  aiGatewayDateFrom: string;
  aiGatewayDateTo: string;
  /** AI Gateway 模型管理演示模式：开启后用本地 mock 数据驱动列表与授权 UI（显式开关，非静默降级） */
  aiGatewayDemoMode: boolean;
  searchQuery: string;
  selectedId: string | null;
  selectedRunId: string | null;
  selectedSuiteId: string | null;
  drawerOpen: boolean;

  setSection: (section: AdminSection) => void;
  setPlatformSection: (section: PlatformSection) => void;
  setAIGatewayTab: (tab: AIGatewayTab) => void;
  toggleAIGatewayDemoMode: () => void;
  setAIGatewayDateRange: (from: string, to: string) => void;
  setAIGatewayDateThisWeek: () => void;
  setAIGatewayDateRecentDays: (days: number) => void;
  setAIGatewayDateAll: () => void;
  setSearchQuery: (query: string) => void;
  selectItem: (id: string | null) => void;
  openDrawer: () => void;
  closeDrawer: () => void;
  navigateToRunDetail: (runId: string) => void;
  exitRunDetail: () => void;
  navigateToSuiteDetail: (suiteId: string) => void;
  exitSuiteDetail: () => void;
}

export const useAdminStore = create<AdminState>((set) => ({
  currentSection: 'employees',
  platformSection: 'tenants',
  aiGatewayTab: 'models',
  aiGatewayDateFrom: initialAiGatewayWeek.from,
  aiGatewayDateTo: initialAiGatewayWeek.to,
  aiGatewayDemoMode: false,
  searchQuery: '',
  selectedId: null,
  selectedRunId: null,
  selectedSuiteId: null,
  drawerOpen: false,

  setSection: (section) =>
    set({ currentSection: section, selectedId: null, drawerOpen: false, searchQuery: '' }),
  setPlatformSection: (section) => set({ platformSection: section, searchQuery: '' }),
  setAIGatewayTab: (tab) => set({ aiGatewayTab: tab }),
  toggleAIGatewayDemoMode: () => set((s) => ({ aiGatewayDemoMode: !s.aiGatewayDemoMode })),
  setAIGatewayDateRange: (from, to) =>
    set({ aiGatewayDateFrom: from, aiGatewayDateTo: to }),
  setAIGatewayDateThisWeek: () => {
    const { from, to } = computeThisWeekRange();
    set({ aiGatewayDateFrom: from, aiGatewayDateTo: to });
  },
  setAIGatewayDateRecentDays: (days) => {
    const { from, to } = computeRecentDaysRange(days);
    set({ aiGatewayDateFrom: from, aiGatewayDateTo: to });
  },
  setAIGatewayDateAll: () => set({ aiGatewayDateFrom: '', aiGatewayDateTo: '' }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  selectItem: (id) => set({ selectedId: id, drawerOpen: !!id }),
  openDrawer: () => set({ drawerOpen: true }),
  closeDrawer: () => set({ drawerOpen: false, selectedId: null }),
  navigateToRunDetail: (runId) =>
    set({ currentSection: 'eval-experiment-detail', selectedRunId: runId }),
  exitRunDetail: () =>
    set({ currentSection: 'eval-experiments', selectedRunId: null }),
  navigateToSuiteDetail: (suiteId) =>
    set({ currentSection: 'eval-suite-detail', selectedSuiteId: suiteId }),
  exitSuiteDetail: () =>
    set({ currentSection: 'eval-suites', selectedSuiteId: null }),
}));
