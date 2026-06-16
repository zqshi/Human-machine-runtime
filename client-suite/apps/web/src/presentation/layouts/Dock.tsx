/**
 * Dock — 左侧 80px 图标导航栏
 * Switches between IM / OpenClaw item sets based on appMode.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useUIStore } from '../../application/stores/uiStore';
import { useAuthStore } from '../../application/stores/authStore';
import { useChatStore } from '../../application/stores/chatStore';
import { Avatar } from '../components/ui/Avatar';
import { Icon } from '../components/ui/Icon';
import { useToastStore } from '../../application/stores/toastStore';
import type { DockTab } from '../../domain/shared/types';

interface DockItem {
  key: DockTab;
  icon: string;
  label: string;
}

/* ── IM mode items ── */
const IM_TOP_ITEMS: DockItem[] = [
  { key: 'messages', icon: 'chat_bubble', label: '消息' },
  { key: 'apps', icon: 'grid_view', label: '轻应用' },
  { key: 'knowledge', icon: 'menu_book', label: '知识库' },
  { key: 'tasks', icon: 'task_alt', label: '待办' },
  { key: 'calendar', icon: 'calendar_month', label: '日历' },
];
const IM_BOTTOM_ITEMS: DockItem[] = [
  { key: 'contacts', icon: 'people', label: '通讯录' },
  { key: 'agents', icon: 'smart_toy', label: 'Agent' },
  { key: 'settings', icon: 'settings', label: '设置' },
];

/* ── OpenClaw mode items ── */
const OC_TOP_ITEMS: DockItem[] = [
  { key: 'openclaw', icon: 'terminal', label: '工作面板' },
  { key: 'knowledge', icon: 'menu_book', label: '知识库' },
  { key: 'studio', icon: 'category', label: 'Studio' },
  { key: 'marketplace', icon: 'storefront', label: '共享' },
];
const OC_BOTTOM_ITEMS: DockItem[] = [
  { key: 'agents', icon: 'groups', label: 'Team' },
  { key: 'settings', icon: 'settings', label: '设置' },
];

interface DockProps {
  onLogout?: () => void;
}

export function Dock({ onLogout }: DockProps) {
  const currentDock = useUIStore((s) => s.currentDock);
  const setDock = useUIStore((s) => s.setDock);
  const appMode = useUIStore((s) => s.appMode);
  const setAppMode = useUIStore((s) => s.setAppMode);
  const user = useAuthStore((s) => s.user);
  const rooms = useChatStore((s) => s.rooms);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const avatarRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState({ bottom: 0, left: 0 });

  const isOC = appMode === 'openclaw';

  const topItems = isOC ? OC_TOP_ITEMS : IM_TOP_ITEMS;
  const bottomItems = isOC ? OC_BOTTOM_ITEMS : IM_BOTTOM_ITEMS;

  const totalUnread = rooms.reduce((sum, r) => sum + (r.unreadCount ?? 0), 0);

  const openMenu = useCallback(() => {
    if (avatarRef.current) {
      const rect = avatarRef.current.getBoundingClientRect();
      setMenuPos({
        bottom: window.innerHeight - rect.top + 4,
        left: rect.left + rect.width / 2 - 96, // 96 = half of w-48 (192px)
      });
    }
    setMenuOpen(true);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        avatarRef.current &&
        !avatarRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const renderButton = (item: DockItem) => (
    <button
      type="button"
      key={item.key}
      onClick={() => setDock(item.key)}
      title={item.label}
      className={`relative w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
        currentDock === item.key
          ? isOC
            ? 'bg-[rgba(0,212,184,0.15)] text-[#00D4B8]'
            : 'bg-primary/10 text-primary'
          : isOC
            ? 'text-slate-400 hover:bg-white/5'
            : 'text-text-secondary hover:bg-bg-hover'
      }`}
    >
      <Icon name={item.icon} size={22} filled={currentDock === item.key} />
      {item.key === 'messages' && totalUnread > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-error text-white text-[10px] font-bold flex items-center justify-center leading-none">
          {totalUnread > 99 ? '99+' : totalUnread}
        </span>
      )}
    </button>
  );

  return (
    <nav
      className={`flex flex-col items-center py-4 gap-2 border-r backdrop-blur-[20px] ${
        isOC
          ? 'border-white/10 bg-[rgba(10,15,30,0.85)]'
          : 'border-border bg-[rgba(255,255,255,0.7)]'
      }`}
      style={{ width: 'var(--dock-width)' }}
    >
      {/* Logo / Mode Toggle */}
      <button
        type="button"
        onClick={() => setAppMode(isOC ? 'im' : 'openclaw')}
        title={isOC ? '切换到 IM 模式' : '切换到工作面板模式'}
        className={`w-10 h-10 rounded-xl flex items-center justify-center text-white mb-1 transition-all ${
          isOC
            ? 'bg-gradient-to-br from-[#00D4B8] to-[#00A893] shadow-[0_0_15px_rgba(0,212,184,0.4)]'
            : 'bg-gradient-to-br from-primary to-primary-dark'
        }`}
      >
        <Icon name={isOC ? 'smart_toy' : 'hub'} size={22} />
      </button>

      {/* Mode label */}
      <span
        className={`text-[9px] font-semibold tracking-wide ${isOC ? 'text-[#00D4B8]' : 'text-text-secondary'}`}
      >
        {isOC ? 'Almighty' : 'HMR'}
      </span>

      {/* Divider */}
      <div className={`w-8 h-px ${isOC ? 'bg-white/10' : 'bg-border'}`} />

      {/* Top navigation */}
      <div className="flex flex-col gap-1 flex-1">{topItems.map(renderButton)}</div>

      {/* Divider */}
      <div className={`w-8 h-px ${isOC ? 'bg-white/10' : 'bg-border'}`} />

      {/* Growth Journey — OpenClaw only */}
      {isOC && (
        <button
          type="button"
          onClick={() =>
            useToastStore.getState().addToast('放心你已经成长了，可视化部分敬请期待', 'info')
          }
          title="成长历程"
          className="w-12 h-12 rounded-2xl flex items-center justify-center text-slate-400 hover:bg-white/5 transition-all"
        >
          <Icon name="trending_up" size={22} />
        </button>
      )}

      {/* Bottom navigation + avatar */}
      <div className="flex flex-col items-center gap-1">
        {bottomItems.map(renderButton)}
        <button type="button" ref={avatarRef} onClick={openMenu} className="relative mt-1">
          <Avatar letter={user?.displayName?.charAt(0) ?? 'U'} size={36} />
        </button>
      </div>

      {/* Avatar menu — rendered via portal to avoid overflow clipping */}
      {menuOpen &&
        createPortal(
          <div
            ref={menuRef}
            className={`fixed w-48 border rounded-xl py-1 z-[9999] ${
              isOC
                ? 'bg-[#0F1629] border-white/10 shadow-lg'
                : 'bg-bg-white-var border-border shadow-card'
            }`}
            style={{ bottom: menuPos.bottom, left: Math.max(4, menuPos.left) }}
          >
            <div className={`px-3 py-2 border-b ${isOC ? 'border-white/10' : 'border-border'}`}>
              <p
                className={`text-sm font-medium truncate ${isOC ? 'text-slate-100' : 'text-text-primary'}`}
              >
                {user?.displayName ?? '用户'}
              </p>
              <p className={`text-[10px] truncate ${isOC ? 'text-slate-500' : 'text-text-muted'}`}>
                {user?.userId}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setDock('settings');
                useUIStore.getState().setSubView('settings:profile');
              }}
              className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                isOC ? 'text-slate-200 hover:bg-white/5' : 'text-text-primary hover:bg-bg-hover'
              }`}
            >
              个人资料
            </button>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setDock('settings');
              }}
              className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                isOC ? 'text-slate-200 hover:bg-white/5' : 'text-text-primary hover:bg-bg-hover'
              }`}
            >
              设置
            </button>
            {onLogout && (
              <>
                <div className={`border-t my-1 ${isOC ? 'border-white/10' : 'border-border'}`} />
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onLogout();
                  }}
                  className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                    isOC ? 'text-red-400 hover:bg-white/5' : 'text-error hover:bg-bg-hover'
                  }`}
                >
                  退出登录
                </button>
              </>
            )}
          </div>,
          document.body
        )}
    </nav>
  );
}
