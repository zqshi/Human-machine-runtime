import { create } from 'zustand';
import { request } from '../../infrastructure/api/adminApiClient';
import type { AppCategory, AppItem } from '../../domain/app/AppTypes';

interface AppCatalogState {
  items: AppItem[];
  loading: boolean;
  error: string | null;
  fetchAppCatalog: () => Promise<void>;
}

interface BackendCatalogItem {
  id: number;
  name: string;
  icon: string;
  iconColor: string;
  category: string;
  description: string | null;
  status: string;
  sortOrder: number;
  visible: boolean;
}

const CATEGORY_MAP: Record<string, AppCategory> = {
  办公工具: 'office',
  人事服务: 'hr',
  财务法务: 'finance',
  'IT 服务': 'it',
  数据洞察: 'data',
  我的创作: 'my-creations',
};

function toAppItem(item: BackendCatalogItem): AppItem {
  return {
    id: String(item.id),
    name: item.name,
    icon: item.icon,
    description: item.description ?? '',
    category: CATEGORY_MAP[item.category] ?? 'office',
    color: item.iconColor,
  };
}

export const useAppCatalogStore = create<AppCatalogState>((set, get) => ({
  items: [],
  loading: false,
  error: null,

  async fetchAppCatalog() {
    if (get().loading) return;
    set({ loading: true, error: null });
    try {
      const data = await request<{ items: BackendCatalogItem[] }>('/api/control/app-catalog');
      const items: AppItem[] = (data.items ?? [])
        .filter((i) => i.visible !== false && i.status !== 'disabled')
        .map(toAppItem);
      set({ items, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },
}));
