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
    });
  },

  setDock(tab) {
    set({ currentDock: tab, subView: null, drawerOpen: false, drawerContent: null });
  },

  setAppMode(mode) {
    const dock: DockTab = mode === 'openclaw' ? 'openclaw' : 'messages';
    set({ appMode: mode, currentDock: dock, subView: null, drawerOpen: false, drawerContent: null });
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
}));
