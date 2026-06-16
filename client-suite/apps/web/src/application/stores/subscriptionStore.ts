import { create } from 'zustand';
import { Subscription } from '../../domain/subscription/Subscription';
import type { SubscriptionType } from '../../domain/subscription/Subscription';
import type { FeedItem, SubscriptionSource } from '../../domain/subscription/FeedTypes';
import { logsApi } from '../../infrastructure/api/dcfApiClient';

export type CategoryFilter = 'all' | SubscriptionType;
export type SidebarTab = 'all' | 'sources' | 'alerts';

interface SubscriptionState {
  subscriptions: Subscription[];
  feedItems: FeedItem[];
  sources: SubscriptionSource[];
  activeCategory: CategoryFilter;
  sidebarTab: SidebarTab;
  showDashboard: boolean;
  feedLoading: boolean;

  reset(): void;
  setActiveCategory(category: CategoryFilter): void;
  setSidebarTab(tab: SidebarTab): void;
  toggleSubscription(id: string): void;
  setShowDashboard(show: boolean): void;
  fetchFromBackend(): Promise<void>;
}

export const useSubscriptionStore = create<SubscriptionState>((set) => ({
  subscriptions: [],
  feedItems: [],
  sources: [],
  activeCategory: 'all',
  sidebarTab: 'all',
  showDashboard: false,
  feedLoading: false,

  reset() {
    set({
      subscriptions: [],
      feedItems: [],
      sources: [],
      activeCategory: 'all',
      sidebarTab: 'all',
      showDashboard: false,
    });
  },

  setActiveCategory(category: CategoryFilter) {
    set({ activeCategory: category });
  },

  setSidebarTab(tab: SidebarTab) {
    set({ sidebarTab: tab });
  },

  toggleSubscription(id: string) {
    set((state) => ({
      subscriptions: state.subscriptions.map((s) => (s.id === id ? s.toggleEnabled() : s)),
    }));
  },

  setShowDashboard(show: boolean) {
    set({ showDashboard: show });
  },

  async fetchFromBackend() {
    set({ feedLoading: true });
    try {
      const logs = await logsApi.list();
      if (Array.isArray(logs) && logs.length > 0) {
        const mapped: FeedItem[] = logs.map((entry: Record<string, unknown>, idx: number) => ({
          id: (entry.id as string) ?? `log-${idx}`,
          subscriptionId: 'backend',
          title: (entry.type as string) ?? (entry.action as string) ?? '系统日志',
          summary: (entry.details as string) ?? (entry.message as string) ?? '',
          source: (entry.source as string) ?? 'Audit',
          timestamp:
            (entry.at as string) ?? (entry.createdAt as string) ?? new Date().toISOString(),
          category: (entry.category as string) ?? '系统',
          importance: 'medium' as const,
        }));
        set({
          feedItems: mapped,
          sources: mapped.reduce<SubscriptionSource[]>((acc, item) => {
            if (!acc.some((s) => s.name === item.source)) {
              acc.push({
                id: `src-${acc.length}`,
                name: item.source,
                type: 'source',
                icon: 'rss_feed',
                iconColor: '#007AFF',
                description: '',
                timestamp: item.timestamp,
                hasUnread: true,
              });
            }
            return acc;
          }, []),
        });
      }
    } catch {
      // API 不可用时保持空列表
    } finally {
      set({ feedLoading: false });
    }
  },
}));
