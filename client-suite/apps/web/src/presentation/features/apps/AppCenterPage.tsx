/**
 * AppCenterPage — 轻应用中心
 * 左侧: 分类导航 (合集/分类)
 * 右侧: 我的创作(管理员) + 最近使用 + 分类网格 + IT服务大卡片
 *
 * 数据源: /api/control/app-catalog
 */
import { useState, useEffect, useCallback } from 'react';
import { Icon } from '../../components/ui/Icon';
import { useToastStore } from '../../../application/stores/toastStore';
import { useUIStore } from '../../../application/stores/uiStore';
import { appCatalogApi, type AppCatalogItem } from '../../../application/services/adminApi';

const NAV_COLLECTIONS = [
  { key: 'all', label: '全部应用', icon: 'apps' },
  { key: 'recent', label: '最近使用', icon: 'history' },
  { key: 'favorites', label: '收藏夹', icon: 'star' },
];

const CATEGORY_ICON_MAP: Record<string, string> = {
  办公工具: 'business_center',
  人事服务: 'people',
  财务法务: 'account_balance',
  'IT 服务': 'devices',
  数据洞察: 'analytics',
  我的创作: 'auto_awesome',
};

interface AppCenterPageProps {
  isAdmin?: boolean;
}

export function AppCenterPage({ isAdmin = true }: AppCenterPageProps) {
  const [activeKey, setActiveKey] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [grouped, setGrouped] = useState<Record<string, AppCatalogItem[]>>({});
  const [loading, setLoading] = useState(true);
  const toast = (msg: string) => useToastStore.getState().addToast(msg, 'info');

  const fetchApps = useCallback(() => {
    appCatalogApi
      .list()
      .then((res) => setGrouped(res.grouped))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(fetchApps, [fetchApps]);

  const categoryNames = Object.keys(grouped).filter((k) => k !== '我的创作');
  const categoryNav = categoryNames.map((name) => ({
    key: name,
    label: name,
    icon: CATEGORY_ICON_MAP[name] || 'folder',
  }));
  const allNav = [...NAV_COLLECTIONS, ...categoryNav];
  const activeLabel = allNav.find((c) => c.key === activeKey)?.label ?? '全部应用';

  const myCreations = grouped['我的创作'] || [];
  const visibleCategories =
    activeKey === 'all' || activeKey === 'recent' || activeKey === 'favorites'
      ? categoryNames
      : categoryNames.filter((name) => name === activeKey);

  const itServices = grouped['IT 服务'] || [];

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex overflow-hidden bg-bg-white-var">
      {/* Left sidebar */}
      <div className="w-56 border-r border-border flex flex-col">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-text-primary">轻应用</h3>
        </div>
        <div className="px-3 py-2">
          <div className="relative">
            <Icon
              name="search"
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted"
            />
            <input
              type="text"
              placeholder="搜索应用…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        <nav className="flex-1 px-2 space-y-0.5">
          <div className="px-3 pt-2 pb-1">
            <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">
              合集
            </span>
          </div>
          {NAV_COLLECTIONS.map((cat) => (
            <button
              key={cat.key}
              type="button"
              onClick={() => setActiveKey(cat.key)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-colors ${
                activeKey === cat.key
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-text-secondary hover:bg-bg-hover'
              }`}
            >
              <Icon name={cat.icon} size={16} />
              {cat.label}
            </button>
          ))}

          <div className="px-3 pt-4 pb-1">
            <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">
              分类
            </span>
          </div>
          {categoryNav.map((cat) => (
            <button
              key={cat.key}
              type="button"
              onClick={() => setActiveKey(cat.key)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-colors ${
                activeKey === cat.key
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-text-secondary hover:bg-bg-hover'
              }`}
            >
              <Icon name={cat.icon} size={16} />
              {cat.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-3 border-b border-border">
          <div className="flex items-center gap-1.5 text-xs text-text-muted">
            <span>轻应用</span>
            <Icon name="chevron_right" size={14} />
            <span className="text-text-primary font-medium">{activeLabel}</span>
          </div>
          <button
            type="button"
            onClick={() => useUIStore.getState().setSubView('apps:create')}
            className="px-3 py-1.5 text-xs font-medium text-white bg-primary rounded-lg hover:bg-primary/90 flex items-center gap-1.5"
          >
            <Icon name="add" size={14} />
            {isAdmin ? '创建我的应用' : '申请新应用'}
          </button>
        </div>

        <div className="p-6 space-y-8">
          {/* My Creations (admin only) */}
          {isAdmin && myCreations.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-sm font-bold text-text-primary">我的创作</h3>
                <span className="px-2 py-0.5 text-[9px] font-medium text-primary bg-primary/10 rounded-full">
                  AI 辅助
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {myCreations.map((app) => (
                  <div
                    key={app.id}
                    onClick={() => toast(`已打开「${app.name}」编辑器`)}
                    className="flex items-center gap-3 p-3 rounded-xl border border-border hover:shadow-md transition-shadow cursor-pointer"
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: `${app.iconColor}15` }}
                    >
                      <Icon name={app.icon} size={20} style={{ color: app.iconColor }} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-text-primary">{app.name}</p>
                      <p className="text-[10px] text-text-muted">{app.description}</p>
                    </div>
                    <span className="px-1.5 py-0.5 text-[8px] font-medium text-success bg-success/10 rounded">
                      Edit with AI
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Category grids */}
          {visibleCategories
            .filter((name) => name !== 'IT 服务')
            .map((catName) => {
              const apps = grouped[catName] || [];
              if (apps.length === 0) return null;
              return (
                <section key={catName}>
                  <h3 className="text-sm font-bold text-text-primary mb-3">{catName}</h3>
                  <div className="grid grid-cols-6 gap-3">
                    {apps.map((app) => (
                      <button
                        key={app.id}
                        type="button"
                        onClick={() => toast(`「${app.name}」已启动，请稍候...`)}
                        className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-bg-hover/50 transition-colors"
                      >
                        <div
                          className="w-12 h-12 rounded-2xl flex items-center justify-center"
                          style={{ backgroundColor: `${app.iconColor}12` }}
                        >
                          <Icon name={app.icon} size={24} style={{ color: app.iconColor }} />
                        </div>
                        <span className="text-xs text-text-primary">{app.name}</span>
                      </button>
                    ))}
                  </div>
                </section>
              );
            })}

          {/* IT Services */}
          {itServices.length > 0 && (
            <section>
              <h3 className="text-sm font-bold text-text-primary mb-3">IT 服务</h3>
              <div className="grid grid-cols-3 gap-3">
                {itServices.map((svc, i) => {
                  const dark = i === 0;
                  return (
                    <div
                      key={svc.id}
                      onClick={() => toast(`正在跳转「${svc.name}」— ${svc.description}`)}
                      className={`p-4 rounded-xl cursor-pointer transition-shadow hover:shadow-md ${
                        dark
                          ? 'bg-surface-dark text-white'
                          : 'bg-fill-tertiary/20 border border-border'
                      }`}
                    >
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${dark ? 'bg-white/10' : ''}`}
                        style={!dark ? { backgroundColor: `${svc.iconColor}15` } : undefined}
                      >
                        <Icon
                          name={svc.icon}
                          size={22}
                          style={{ color: dark ? '#fff' : svc.iconColor }}
                        />
                      </div>
                      <p className={`text-sm font-semibold ${dark ? '' : 'text-text-primary'}`}>
                        {svc.name}
                      </p>
                      <p
                        className={`text-[11px] mt-1 ${dark ? 'text-white/60' : 'text-text-muted'}`}
                      >
                        {svc.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
