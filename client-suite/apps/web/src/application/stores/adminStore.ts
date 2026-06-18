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

/** 可持久化到 URL hash 的主 section（排除 *-detail：detail 关联 runId/suiteId/taskId，
 *  刷新后无 id 会回退到对应列表，避免出现空详情页）。 */
const HASHABLE_ADMIN_SECTIONS: readonly AdminSection[] = [
  'employees',
  'skills',
  'tools',
  'shared-agents',
  'ai-gateway',
  'ai-traces',
  'logs',
  'auth',
  'notifications',
  'data-overview',
  'user-analysis',
  'ops-weekly',
  'realtime-monitor',
  'quota-management',
  'eval-suites',
  'eval-evaluators',
  'eval-experiments',
  'channel-admin',
  'employee-memory',
  'scheduled-tasks',
];

/** 从 URL hash 读取 section（硬刷新后恢复当前页）；非法或缺失返回 'employees'。 */
function readSectionFromHash(): AdminSection {
  if (typeof window === 'undefined') return 'employees';
  const h = window.location.hash.replace(/^#/, '');
  return HASHABLE_ADMIN_SECTIONS.includes(h as AdminSection) ? (h as AdminSection) : 'employees';
}

function writeSectionToHash(section: AdminSection): void {
  if (typeof window === 'undefined') return;
  const target = `#${section}`;
  if (window.location.hash !== target) {
    window.location.hash = target;
  }
}

/** OpsShell 主 section 全部可持久化（无 detail 变体，刷新后均能直接恢复）。 */
const HASHABLE_PLATFORM_SECTIONS: readonly PlatformSection[] = [
  'tenants',
  'plans',
  'users',
  'roles',
  'config',
  'monitoring',
  'audit',
];

/** 从 URL hash 读取 OpsShell section（硬刷新后恢复当前页）；非法或缺失返回 'tenants'。
 *  admin 入口的 hash 不是合法 PlatformSection 时同样 fallback 'tenants'，无害。 */
function readPlatformSectionFromHash(): PlatformSection {
  if (typeof window === 'undefined') return 'tenants';
  const h = window.location.hash.replace(/^#/, '');
  return HASHABLE_PLATFORM_SECTIONS.includes(h as PlatformSection)
    ? (h as PlatformSection)
    : 'tenants';
}

function writePlatformSectionToHash(section: PlatformSection): void {
  if (typeof window === 'undefined') return;
  const target = `#${section}`;
  if (window.location.hash !== target) {
    window.location.hash = target;
  }
}

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
  currentSection: readSectionFromHash(),
  platformSection: readPlatformSectionFromHash(),
  aiGatewayTab: 'models',
  aiGatewayDateFrom: initialAiGatewayWeek.from,
  aiGatewayDateTo: initialAiGatewayWeek.to,
  aiGatewayDemoMode: false,
  searchQuery: '',
  selectedId: null,
  selectedRunId: null,
  selectedSuiteId: null,
  drawerOpen: false,

  setSection: (section) => {
    writeSectionToHash(section);
    set({ currentSection: section, selectedId: null, drawerOpen: false, searchQuery: '' });
  },
  setPlatformSection: (section) => {
    writePlatformSectionToHash(section);
    set({ platformSection: section, searchQuery: '' });
  },
  setAIGatewayTab: (tab) => set({ aiGatewayTab: tab }),
  toggleAIGatewayDemoMode: () => set((s) => ({ aiGatewayDemoMode: !s.aiGatewayDemoMode })),
  setAIGatewayDateRange: (from, to) => set({ aiGatewayDateFrom: from, aiGatewayDateTo: to }),
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
  exitRunDetail: () => set({ currentSection: 'eval-experiments', selectedRunId: null }),
  navigateToSuiteDetail: (suiteId) =>
    set({ currentSection: 'eval-suite-detail', selectedSuiteId: suiteId }),
  exitSuiteDetail: () => set({ currentSection: 'eval-suites', selectedSuiteId: null }),
}));

// 浏览器后退/前进或手改 hash 时同步 currentSection + platformSection（与各自 setter 写 hash 形成双向闭环）。
// admin.html / ops.html 是不同入口，各自加载本 store，hash 独立；非合法值 fallback 无害、互不干扰。
if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    const nextSection = readSectionFromHash();
    if (nextSection !== useAdminStore.getState().currentSection) {
      useAdminStore.setState({
        currentSection: nextSection,
        selectedId: null,
        drawerOpen: false,
        searchQuery: '',
      });
    }
    const nextPlatform = readPlatformSectionFromHash();
    if (nextPlatform !== useAdminStore.getState().platformSection) {
      useAdminStore.setState({ platformSection: nextPlatform, searchQuery: '' });
    }
  });
}
