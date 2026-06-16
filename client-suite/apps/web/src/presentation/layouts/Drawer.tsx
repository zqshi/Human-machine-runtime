/**
 * Drawer — 右侧挤压式抽屉面板
 *
 * Features:
 * - Draggable resize via left-edge handle (360-900px)
 * - Double-click handle to reset to default width
 * - Panel registry for extensible content types (doc/code/preview/markdown/spreadsheet/location)
 * - All panels lazy-loaded via React.lazy + Suspense
 */
import { useState, useRef, useEffect, useMemo, Suspense, useCallback } from 'react';
import { useUIStore } from '../../application/stores/uiStore';
import { useResizable } from '../hooks/useResizable';
import { DrawerHeader } from '../features/drawer/DrawerHeader';
import { NLEditInput } from '../features/drawer/NLEditInput';
import { panelRegistry, getAvailablePanels, type PanelKey } from '../features/drawer/panelRegistry';
import { Icon } from '../components/ui/Icon';
import { documentApi } from '../../application/services/apiGateway';

function LoadingSkeleton() {
  return (
    <div className="flex-1 flex items-center justify-center text-text-muted text-sm">
      <Icon name="hourglass_empty" size={20} className="animate-spin mr-2" />
      加载中...
    </div>
  );
}

export function Drawer() {
  const {
    drawerOpen,
    drawerContent,
    closeDrawer,
    drawerWidth,
    setDrawerWidth,
    resetDrawerWidth,
    isDraggingDrawer,
    setIsDraggingDrawer,
    sidebarWidth,
  } = useUIStore();
  const [activeTab, setActiveTab] = useState<PanelKey>('doc');
  const [visible, setVisible] = useState(false);
  const [shouldRenderContent, setShouldRenderContent] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const containerRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const docIdRef = useRef<string | null>(null);
  const drawerContentRef = useRef(drawerContent);
  useEffect(() => { drawerContentRef.current = drawerContent; }, [drawerContent]);

  // Track docId from drawerContent
  useEffect(() => {
    const id = (drawerContent?.data as Record<string, unknown>)?.docId as string | undefined;
    docIdRef.current = id ?? null;
  }, [drawerContent]);

  // Cleanup save timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // Debounced auto-save
  const debouncedSave = useCallback((newData: Record<string, unknown>) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        setSaveStatus('saving');
        const content = { ...newData };
        delete content.docId;
        if (docIdRef.current) {
          await documentApi.update(docIdRef.current, { content });
        } else {
          const dc = drawerContentRef.current;
          const title = dc?.title || '未命名文档';
          const type = (dc?.type || 'doc') as 'doc' | 'code' | 'markdown';
          const res = await documentApi.create({ title, type, content });
          docIdRef.current = res.document.id;
          if (dc) {
            useUIStore.getState().openDrawer({
              ...dc,
              data: { ...newData, docId: res.document.id },
            });
          }
        }
        setSaveStatus('saved');
      } catch {
        setSaveStatus('error');
      }
    }, 1500);
  }, []);

  // Compute max drawer width dynamically
  const getMaxWidth = useCallback(
    () => Math.max(360, Math.min(900, window.innerWidth - 80 - sidebarWidth - 360)),
    [sidebarWidth]
  );

  const { handlePointerDown } = useResizable({
    direction: -1,
    min: 360,
    max: getMaxWidth,
    currentWidth: drawerWidth,
    containerRef: containerRef,
    onWidthChange: setDrawerWidth,
    onDragStart: () => setIsDraggingDrawer(true),
    onDragEnd: () => setIsDraggingDrawer(false),
  });

  const handleDoubleClick = useCallback(() => {
    resetDrawerWidth();
  }, [resetDrawerWidth]);

  const data = drawerContent?.data as Record<string, unknown> | undefined;
  const contentType = drawerContent?.type ?? 'doc';

  const availableTabs = useMemo(() => {
    if (!drawerContent) return [] as PanelKey[];
    return getAvailablePanels(data ?? {}, contentType);
  }, [drawerContent, data, contentType]);

  // Reset tab when drawer content changes and current tab is unavailable
  if (drawerContent && availableTabs.length > 0 && !availableTabs.includes(activeTab)) {
    setActiveTab(availableTabs[0]);
  }

  // Sync render/visible state from drawerOpen (render-phase)
  if (drawerOpen && drawerContent && !shouldRenderContent) {
    setShouldRenderContent(true);
  }
  if ((!drawerOpen || !drawerContent) && visible) {
    setVisible(false);
  }

  useEffect(() => {
    if (drawerOpen && drawerContent) {
      requestAnimationFrame(() => {
        setVisible(true);
      });
    }
  }, [drawerOpen, drawerContent]);

  const handleTransitionEnd = () => {
    if (!visible) {
      setShouldRenderContent(false);
      // Clear stale content + reset width after close animation finishes (prevents flash)
      if (!useUIStore.getState().drawerOpen) {
        useUIStore.setState({ drawerContent: null, drawerWidth: 0 });
      }
    }
  };
  if (!shouldRenderContent && !visible) return null;

  const widthStyle = visible
    ? drawerWidth > 0
      ? `${drawerWidth}px`
      : 'var(--drawer-width)'
    : '0px';

  const transitionStyle = isDraggingDrawer ? 'none' : 'width 280ms cubic-bezier(0.4, 0, 0.2, 1)';

  const ActivePanel = panelRegistry[activeTab]?.component;
  const status = (drawerContent?.data as Record<string, string>)?.status;

  return (
    <div
      ref={containerRef}
      onTransitionEnd={handleTransitionEnd}
      className="relative flex flex-col border-l border-border bg-bg-white-var shadow-drawer overflow-hidden shrink-0"
      style={{ width: widthStyle, transition: transitionStyle }}
    >
      {/* Drag handle — left edge */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/20 active:bg-primary/30 transition-colors z-20"
        onMouseDown={handlePointerDown}
        onTouchStart={handlePointerDown}
        onDoubleClick={handleDoubleClick}
      />

      <DrawerHeader
        title={drawerContent?.title}
        status={status}
        contentType={contentType}
        saveStatus={saveStatus}
        onClose={closeDrawer}
      />

      {/* Tab bar */}
      {availableTabs.length > 1 && (
        <div className="flex border-b border-border shrink-0 min-w-[360px]">
          {availableTabs.map((tab) => {
            const reg = panelRegistry[tab];
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-xs font-medium transition-colors relative flex items-center gap-1.5 ${
                  activeTab === tab ? 'text-primary' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <Icon name={reg.icon} size={14} />
                {reg.label}
                {activeTab === tab && (
                  <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-hidden min-w-[360px]">
        <Suspense fallback={<LoadingSkeleton />}>
          {ActivePanel && (
            <ActivePanel
              data={data ?? {}}
              onChange={(newData) => {
                if (drawerContent) {
                  useUIStore.getState().openDrawer({ ...drawerContent, data: newData });
                  debouncedSave(newData as Record<string, unknown>);
                }
              }}
            />
          )}
        </Suspense>
      </div>

      {/* NL edit input — hide for code panel (has its own AI assistant) */}
      {activeTab !== 'code' && <NLEditInput />}
    </div>
  );
}
