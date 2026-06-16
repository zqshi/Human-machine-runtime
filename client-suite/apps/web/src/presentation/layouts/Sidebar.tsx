/**
 * Sidebar — 左侧 320px 面板容器
 * 根据 currentDock 切换内容
 */
import { type ReactNode } from 'react';
import { GlassPanel } from '../components/ui/GlassPanel';
import { useUIStore } from '../../application/stores/uiStore';
import { useResizable } from '../hooks/useResizable';

interface SidebarProps {
  children: ReactNode;
}

export function Sidebar({ children }: SidebarProps) {
  const sidebarWidth = useUIStore((s) => s.sidebarWidth);
  const setSidebarWidth = useUIStore((s) => s.setSidebarWidth);

  const { handlePointerDown } = useResizable({
    direction: 1,
    min: 260,
    max: 400,
    currentWidth: sidebarWidth,
    onWidthChange: setSidebarWidth,
  });

  return (
    <GlassPanel
      className="relative flex flex-col border-r border-border overflow-hidden"
    >
      <div className="flex flex-col h-full" style={{ width: sidebarWidth }}>
        {children}
      </div>
      {/* Resizer */}
      <div
        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/20 active:bg-primary/30 transition-colors z-10"
        onMouseDown={handlePointerDown}
        onTouchStart={handlePointerDown}
      />
    </GlassPanel>
  );
}
