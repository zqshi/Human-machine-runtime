/**
 * WorkspacePage — 主工作台
 * 通过 dockRegistry 声明式路由，替换原有 switch-case
 */
import { useEffect } from 'react';
import { AppShell } from '../layouts/AppShell';
import { Sidebar } from '../layouts/Sidebar';
import { useUIStore } from '../../application/stores/uiStore';
import { useAuthStore } from '../../application/stores/authStore';
import { useAgentStore } from '../../application/stores/agentStore';
import { useNotificationStore } from '../../application/stores/notificationStore';
import { useTodoStore } from '../../application/stores/todoStore';
import { useOpenClawStore } from '../../application/stores/openclawStore';
import { useAppCatalogStore } from '../../application/stores/appCatalogStore';
import { useMatrixClient } from '../../application/hooks/useMatrixClient';
import { getDockRoute } from '../routing/dockRegistry';
import { registerAllRoutes } from '../routing/registerRoutes';
import type { DockTab } from '../../domain/shared/types';

// Register routes once at module load
registerAllRoutes();

export function WorkspacePage() {
  const currentDock = useUIStore((s) => s.currentDock);
  const appMode = useUIStore((s) => s.appMode);
  const isBackendConnected = useAuthStore((s) => s.isBackendConnected);
  const { logout } = useMatrixClient();

  // Support ?tab= query param for direct navigation
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab && getDockRoute(tab as DockTab)) {
      useUIStore.getState().setDock(tab as DockTab);
    }
  }, []);

  // When backend is connected, fetch live data from HMR API
  useEffect(() => {
    if (!isBackendConnected) return;
    useAgentStore.getState().fetchFromBackend();
    useNotificationStore.getState().fetchFromBackend();
    useTodoStore.getState().fetchFromBackend();
    useAppCatalogStore.getState().fetchAppCatalog();
  }, [isBackendConnected]);

  // Initialize OpenClaw store when entering openclaw mode
  useEffect(() => {
    if (appMode !== 'openclaw') return;
    useOpenClawStore.getState().initialize();
    return () => {
      useOpenClawStore.getState().reset();
    };
  }, [appMode]);

  const subView = useUIStore((s) => s.subView);
  const route = getDockRoute(currentDock);
  const SidebarContent = route?.Sidebar;
  const MainContent = route?.Main;

  // Hide sidebar in full-screen sub-views
  const hideSidebar =
    subView === 'apps:create' || subView === 'apps:view' || subView === 'apps:edit';

  return (
    <AppShell
      sidebar={
        hideSidebar || !SidebarContent ? null : (
          <Sidebar>
            <SidebarContent />
          </Sidebar>
        )
      }
      onLogout={logout}
    >
      {MainContent ? <MainContent /> : null}
    </AppShell>
  );
}
