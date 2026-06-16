export interface AppItem {
  id: string;
  name: string;
  icon: string;
  description: string;
  category: AppCategory;
  color: string;
  aiCreated?: boolean;
  version?: string;
  subLabel?: string;
}

export type AppCategory = 'my-creations' | 'office' | 'hr' | 'finance' | 'it' | 'data';

export interface RecentApp {
  id: string;
  name: string;
  icon: string;
  color: string;
  subLabel: string;
  version: string;
}

export type DisplayMode = 'live' | 'report' | 'tool';

export interface LiveSummary {
  items: { label: string; value: string; trend?: 'up' | 'down' }[];
  lastRefreshed: string;
  hasNewData?: boolean;
}

export interface MyCreation {
  id: string;
  name: string;
  icon: string;
  color: string;
  subLabel: string;
  updatedAt: string;
  displayMode: DisplayMode;
  lastAccessedAt: string;
  summary?: LiveSummary;
  pinned?: boolean;
}

export const APP_CATEGORIES: { key: AppCategory; label: string; icon: string }[] = [
  { key: 'office', label: '办公工具', icon: 'business_center' },
  { key: 'hr', label: '人事服务', icon: 'people' },
  { key: 'finance', label: '财务法务', icon: 'account_balance' },
  { key: 'it', label: 'IT 服务', icon: 'dns' },
  { key: 'data', label: '数据洞察', icon: 'bar_chart' },
];

const LIVE_KW = ['聚合', '订阅', '动态', '监控', 'feed', '看板', '资讯', '新闻', '实时'];
const REPORT_KW = ['报告', '周报', '月报', '日报', '统计', '概览', '分析', '汇报', '数据'];

export function inferDisplayMode(prompt: string): DisplayMode {
  const lower = prompt.toLowerCase();
  if (LIVE_KW.some((kw) => lower.includes(kw))) return 'live';
  if (REPORT_KW.some((kw) => lower.includes(kw))) return 'report';
  return 'tool';
}
