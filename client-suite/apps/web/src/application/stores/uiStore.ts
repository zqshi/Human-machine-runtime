import { create } from 'zustand';
import type { DockTab, AppMode, DrawerContentType } from '../../domain/shared/types';

interface DrawerContent {
  type: DrawerContentType;
  title: string;
  data: Record<string, unknown>;
}

/**
 * Sub-view identifier for secondary views within a Dock tab.
 * Format: 'tabKey:viewName' e.g. 'knowledge:drafts', 'openclaw:task-detail'
 */
type SubView = string | null;

interface UIState {
  currentDock: DockTab;
  appMode: AppMode;
  drawerOpen: boolean;
  drawerContent: DrawerContent | null;
  sidebarWidth: number;
  /** 0 = use CSS --drawer-width default */
  drawerWidth: number;
  isDraggingDrawer: boolean;
  subView: SubView;
  /** OpenClaw: currently selected agent id */
  selectedAgentId: string | null;
  /** Contacts: department filter */
  contactsDept: string;
  /** IM 模式内共享 Agent 对话：当前打开的 agent id（null=显示 Agent Team 列表） */
  imChatAgentId: string | null;

  reset(): void;
  setDock(tab: DockTab): void;
  setAppMode(mode: AppMode): void;
  openDrawer(content: DrawerContent): void;
  closeDrawer(): void;
  setSidebarWidth(width: number): void;
  setDrawerWidth(width: number): void;
  resetDrawerWidth(): void;
  setIsDraggingDrawer(v: boolean): void;
  setSubView(view: SubView): void;
  setSelectedAgentId(id: string | null): void;
  setContactsDept(dept: string): void;
  setImChatAgentId(id: string | null): void;
}

export const useUIStore = create<UIState>((set) => ({
  currentDock: 'messages',
  appMode: 'im',
  drawerOpen: false,
  drawerContent: null,
  sidebarWidth: 320,
  drawerWidth: 0,
  isDraggingDrawer: false,
  subView: null,
  selectedAgentId: 'sa-1',
  contactsDept: 'all',
  imChatAgentId: null,

  reset() {
    set({
      currentDock: 'messages',
      appMode: 'im',
      drawerOpen: false,
      drawerContent: null,
      sidebarWidth: 320,
      drawerWidth: 0,
      isDraggingDrawer: false,
      subView: null,
      selectedAgentId: 'sa-1',
      contactsDept: 'all',
      imChatAgentId: null,
    });
  },

  setDock(tab) {
    // 模式专属 dock 强制对齐 appMode，防止 currentDock 与 appMode 分裂（IM/Almighty 双模式混乱根因）。
    // 跨模式 dock（knowledge/apps/contacts/tasks/calendar/agents/studio/marketplace/settings）
    // 不动 appMode，保持当前模式主题（OC 模式点知识库仍留 OC 主题）。
    const alignedMode: AppMode | null =
      tab === 'openclaw' ? 'openclaw' : tab === 'messages' ? 'im' : null;
    set({
      currentDock: tab,
      subView: null,
      drawerOpen: false,
      drawerContent: null,
      ...(alignedMode ? { appMode: alignedMode } : {}),
    });
  },

  setAppMode(mode) {
    const dock: DockTab = mode === 'openclaw' ? 'openclaw' : 'messages';
    set({
      appMode: mode,
      currentDock: dock,
      subView: null,
      drawerOpen: false,
      drawerContent: null,
    });
  },

  openDrawer(content) {
    set({ drawerOpen: true, drawerContent: content });
  },

  closeDrawer() {
    // Only set drawerOpen=false; drawerContent is preserved during close animation.
    // Drawer component clears content after transition ends via handleTransitionEnd.
    set({ drawerOpen: false });
  },

  setSidebarWidth(width) {
    set({ sidebarWidth: Math.max(260, Math.min(400, width)) });
  },

  setDrawerWidth(width) {
    set({ drawerWidth: Math.max(360, Math.min(900, width)) });
  },

  resetDrawerWidth() {
    set({ drawerWidth: 0 });
  },

  setIsDraggingDrawer(v) {
    set({ isDraggingDrawer: v });
  },

  setSubView(view) {
    set({ subView: view });
  },

  setSelectedAgentId(id) {
    set({ selectedAgentId: id });
  },

  setContactsDept(dept) {
    set({ contactsDept: dept });
  },

  setImChatAgentId(id) {
    set({ imChatAgentId: id });
  },
}));
