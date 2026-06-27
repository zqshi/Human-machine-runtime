/**
 * AppShell — 三栏布局容器
 * Dock(80px) | Sidebar(320px) | Main(1fr)
 * Drawer 已下沉至各功能域内部按需使用（当前仅 ChatPane）。
 * Binds data-mode attribute for IM / Cockpit theme switching.
 */
import { type ReactNode, useEffect } from 'react';
import { Dock } from './Dock';
import { useUIStore } from '../../application/stores/uiStore';
import { appEvents } from '../../application/events/eventBus';
import { getMatrixClient, globalSelectRoom } from '../../application/hooks/useMatrixClient';
import { useToastStore } from '../../application/stores/toastStore';
import { CockpitHeader } from '../features/cockpit/CockpitHeader';

interface AppShellProps {
  sidebar: ReactNode;
  children: ReactNode;
  onLogout?: () => void;
}

export function AppShell({ sidebar, children, onLogout }: AppShellProps) {
  const appMode = useUIStore((s) => s.appMode);
  const isOC = appMode === 'cockpit';

  // Wire up global event bus → store coordination
  useEffect(() => {
    const unsubs = [
      appEvents.on('navigate:chat', ({ roomId }) => {
        // Switch back to IM mode if in Cockpit
        const ui = useUIStore.getState();
        if (ui.appMode === 'cockpit') {
          ui.setAppMode('im');
        } else {
          ui.setDock('messages');
        }
        // Use full selectRoom flow (load messages + clear unread)
        globalSelectRoom(roomId);
      }),
      appEvents.on('navigate:knowledge', ({ subView, documentId }) => {
        const ui = useUIStore.getState();
        if (ui.appMode === 'cockpit') {
          ui.setAppMode('im');
        }
        ui.setDock('knowledge');
        ui.setSubView(subView);
        if (documentId) {
          import('../../application/stores/knowledgeStore').then(({ useKnowledgeStore }) => {
            useKnowledgeStore.getState().selectDocument(documentId);
          });
        }
      }),
      appEvents.on('im:reply-sent', ({ roomId, message }) => {
        const client = getMatrixClient();
        if (client) client.sendMessage(roomId, message);
      }),
      appEvents.on('approval:resolved', ({ documentName: _documentName, approved: _approved }) => {
        // Refresh knowledge view if on that tab
        if (useUIStore.getState().currentDock === 'knowledge') {
          useUIStore.getState().setSubView(null);
        }
      }),
      appEvents.on('im:cross-channel-reply', ({ channel, sender: _sender, message: _message }) => {
        useToastStore.getState().addToast(`已向 ${channel} 渠道发送回复`, 'success');
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  return (
    <div
      data-mode={appMode}
      className={`h-full flex overflow-hidden ${isOC ? 'bg-[#0A0F1E]' : 'bg-bg-light'}`}
    >
      <Dock onLogout={onLogout} />
      {sidebar && sidebar}
      <div className="flex-1 min-w-0 min-h-0 flex flex-col">
        {isOC && <CockpitHeader />}
        <main className={`flex-1 min-w-0 min-h-0 flex flex-col bg-bg-white-var`}>
          {children}
        </main>
      </div>
    </div>
  );
}
