/**
 * AppsGrid — 轻应用页面（注意力导向三区布局）
 * Live 大卡片 → Report 中卡片 → Tool 快捷入口 → 折叠传统应用
 */
import { useState, useMemo } from 'react';
import { Icon } from '../../components/ui/Icon';
import { AppSection } from './AppSection';
import { useUIStore } from '../../../application/stores/uiStore';
import { useToastStore } from '../../../application/stores/toastStore';
import { useAppCatalogStore } from '../../../application/stores/appCatalogStore';
import { AppCenterPage } from './AppCenterPage';
import { AICreationPanel } from './AICreationPanel';
import { APP_CATEGORIES, type AppItem, type MyCreation } from '../../../domain/app/AppTypes';

const MY_CREATIONS: MyCreation[] = [];

/* ─── Main export ─── */

export function AppsGrid() {
  const subView = useUIStore((s) => s.subView);
  const setSubView = useUIStore((s) => s.setSubView);
  const [viewingApp, setViewingApp] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [expandOrigin, setExpandOrigin] = useState<DOMRect | null>(null);
  const [allAppsExpanded, setAllAppsExpanded] = useState(false);

  const appCatalog = useAppCatalogStore((s) => s.items);
  const catalogLoading = useAppCatalogStore((s) => s.loading);

  const liveApps = MY_CREATIONS.filter((c) => c.displayMode === 'live');
  const reportApps = MY_CREATIONS.filter((c) => c.displayMode === 'report');
  const toolApps = MY_CREATIONS.filter((c) => c.displayMode === 'tool');
  const hasCreations = MY_CREATIONS.length > 0;

  const grouped = useMemo(() => {
    return APP_CATEGORIES.map((cat) => ({
      label: cat.label,
      apps: appCatalog.filter((a) => a.category === cat.key),
    })).filter((g) => g.apps.length > 0);
  }, [appCatalog]);

  const searchResults = useMemo(() => {
    if (!search.trim()) return null;
    const t = search.trim().toLowerCase();
    const creationHits = MY_CREATIONS.filter((c) => c.name.toLowerCase().includes(t));
    const appHits = appCatalog.filter(
      (a) => a.name.toLowerCase().includes(t) || a.description.toLowerCase().includes(t)
    );
    return { creationHits, appHits };
  }, [search, appCatalog]);

  // SubView routing (after all hooks)
  if (subView === 'apps:admin') {
    return <AppCenterPage isAdmin />;
  }
  if (subView === 'apps:create') {
    return (
      <AICreationPanel
        mode="create"
        onClose={() => {
          setSubView(null);
          setViewingApp(null);
          setExpandOrigin(null);
        }}
        originRect={expandOrigin}
      />
    );
  }
  if (subView === 'apps:view' && viewingApp) {
    return (
      <AICreationPanel
        mode="view"
        onClose={() => {
          setSubView(null);
          setViewingApp(null);
        }}
        initialAppName={viewingApp}
        onSwitchToEdit={() => setSubView('apps:edit')}
      />
    );
  }
  if (subView === 'apps:edit' && viewingApp) {
    return (
      <AICreationPanel
        mode="edit"
        onClose={() => {
          setSubView(null);
          setViewingApp(null);
        }}
        initialAppName={viewingApp}
      />
    );
  }

  return (
    <div className="flex-1 overflow-auto hmr-scrollbar">
      <div className="p-6 space-y-4">
        {/* Header */}
        <AppsHeader
          search={search}
          onSearchChange={setSearch}
          onCreateNew={(rect) => {
            setExpandOrigin(rect);
            setSubView('apps:create');
          }}
        />

        {searchResults ? (
          <SearchResults
            creationHits={searchResults.creationHits}
            appHits={searchResults.appHits}
            onViewCreation={(name) => {
              setViewingApp(name);
              setSubView('apps:view');
            }}
          />
        ) : (
          <>
            {/* Zone 1: Live Widgets — side by side on wide screens */}
            {liveApps.length > 0 && (
              <div
                className={`grid gap-4 ${liveApps.length > 1 ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}
              >
                {liveApps.slice(0, 2).map((app) => (
                  <LiveWidgetCard
                    key={app.id}
                    app={app}
                    onView={() => {
                      setViewingApp(app.name);
                      setSubView('apps:view');
                    }}
                    onEdit={() => {
                      setViewingApp(app.name);
                      setSubView('apps:edit');
                    }}
                  />
                ))}
              </div>
            )}

            {/* Zone 2: Report Cards */}
            {reportApps.length > 0 && (
              <div className="space-y-2.5">
                <h3 className="text-sm font-semibold text-text-secondary">数据报告</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {reportApps.map((app) => (
                    <ReportCard
                      key={app.id}
                      app={app}
                      onExpand={() => {
                        setViewingApp(app.name);
                        setSubView('apps:view');
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Zone 3: Tool Chips */}
            {toolApps.length > 0 && (
              <ToolChipRow
                apps={toolApps}
                onOpen={(name) => {
                  setViewingApp(name);
                  setSubView('apps:view');
                }}
              />
            )}

            {/* Zone 4: All traditional apps (collapsible) */}
            {catalogLoading ? (
              <div className="text-center py-8 text-sm text-text-muted">加载应用中…</div>
            ) : (
              <CollapsibleApps
                grouped={grouped}
                expanded={!hasCreations || allAppsExpanded}
                onToggle={() => setAllAppsExpanded((v) => !v)}
              />
            )}

            {!hasCreations && (
              <EmptyCreationGuide
                onCreateNew={(rect) => {
                  setExpandOrigin(rect);
                  setSubView('apps:create');
                }}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ─── AppsHeader ─── */

function AppsHeader({
  search,
  onSearchChange,
  onCreateNew,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  onCreateNew: (rect: DOMRect) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-lg font-semibold text-text-primary">轻应用</h2>
      <div className="flex items-center gap-3">
        <div className="relative">
          <Icon
            name="search"
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="搜索应用..."
            className="pl-9 pr-3 py-2 w-48 text-sm border border-border rounded-xl bg-fill-tertiary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 placeholder:text-text-muted/60"
          />
        </div>
        <button
          type="button"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            onCreateNew(rect);
          }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          <Icon name="auto_awesome" size={16} />
          AI 创建
        </button>
      </div>
    </div>
  );
}

/* ─── LiveWidgetCard ─── */

function LiveWidgetCard({
  app,
  onView,
  onEdit,
}: {
  app: MyCreation;
  onView: () => void;
  onEdit: () => void;
}) {
  const summary = app.summary;
  return (
    <div
      className="rounded-2xl border border-border bg-bg-card overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
      style={{ borderLeft: `4px solid ${app.color}` }}
      onClick={onView}
    >
      {/* Header row */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1.5">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: `${app.color}14` }}
          >
            <Icon name={app.icon} size={18} style={{ color: app.color }} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-text-primary">{app.name}</span>
            {summary?.hasNewData && (
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            )}
          </div>
          {summary?.lastRefreshed && (
            <span className="text-[11px] text-text-muted ml-1">{summary.lastRefreshed}刷新</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onView();
            }}
            className="text-xs text-primary font-medium hover:underline flex items-center gap-0.5"
          >
            查看全部 <Icon name="chevron_right" size={14} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="text-xs text-text-muted font-medium hover:text-text-secondary"
          >
            编辑
          </button>
        </div>
      </div>

      {/* Content: summary items as compact rows */}
      {summary && (
        <div className="px-4 pb-3">
          <div className="space-y-1 pt-1.5 border-t border-border/50">
            {summary.items.map((item, i) => (
              <div key={i} className="flex items-center justify-between py-0.5 text-sm">
                <span className="text-text-primary">• {item.label}</span>
                <span className="text-text-muted text-xs shrink-0 ml-3">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── ReportCard ─── */

function ReportCard({ app, onExpand }: { app: MyCreation; onExpand: () => void }) {
  const summary = app.summary;
  return (
    <div
      className="rounded-2xl border border-border bg-bg-card p-4 hover:shadow-md transition-shadow cursor-pointer"
      onClick={onExpand}
    >
      <div className="flex items-center gap-2.5 mb-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: `${app.color}14` }}
        >
          <Icon name={app.icon} size={18} style={{ color: app.color }} />
        </div>
        <span className="text-sm font-semibold text-text-primary flex-1">{app.name}</span>
        {summary?.hasNewData && (
          <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
            NEW
          </span>
        )}
      </div>

      {summary && (
        <div className="space-y-1.5 mb-3">
          {summary.items.map((item, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <span className="text-text-secondary">{item.label}</span>
              <span
                className={`font-semibold ${
                  item.trend === 'up'
                    ? 'text-success'
                    : item.trend === 'down'
                      ? 'text-error'
                      : 'text-text-primary'
                }`}
              >
                {item.value}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-[11px] text-text-muted">{app.updatedAt}</span>
        <span className="text-xs text-primary font-medium flex items-center gap-0.5">
          展开 <Icon name="chevron_right" size={14} />
        </span>
      </div>
    </div>
  );
}

/* ─── ToolChipRow ─── */

function ToolChipRow({ apps, onOpen }: { apps: MyCreation[]; onOpen: (name: string) => void }) {
  const [showAll, setShowAll] = useState(false);
  const maxVisible = 6;
  const visible = showAll ? apps : apps.slice(0, maxVisible);
  const hasMore = apps.length > maxVisible;

  return (
    <div className="space-y-2.5">
      <h3 className="text-sm font-semibold text-text-secondary">快捷工具</h3>
      <div className="flex flex-wrap gap-2">
        {visible.map((app) => (
          <button
            key={app.id}
            type="button"
            onClick={() => onOpen(app.name)}
            className="flex items-center gap-2 rounded-xl border border-border bg-bg-card px-4 py-2.5 hover:shadow-md transition-shadow"
          >
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: `${app.color}14` }}
            >
              <Icon name={app.icon} size={16} style={{ color: app.color }} />
            </div>
            <span className="text-sm font-medium text-text-primary">{app.name}</span>
          </button>
        ))}
        {hasMore && !showAll && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="flex items-center gap-1.5 rounded-xl border border-dashed border-border bg-fill-tertiary px-4 py-2.5 text-sm text-text-muted hover:bg-hover transition-colors"
          >
            <Icon name="add" size={16} />+{apps.length - maxVisible} 更多
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── CollapsibleApps ─── */

function CollapsibleApps({
  grouped,
  expanded,
  onToggle,
}: {
  grouped: { label: string; apps: AppItem[] }[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const totalCount = grouped.reduce((sum, g) => sum + g.apps.length, 0);
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 cursor-pointer select-none py-1" onClick={onToggle}>
        <div className="flex-1 h-px bg-border" />
        <span className="text-sm font-semibold text-text-secondary flex items-center gap-1.5">
          全部应用
          <span className="text-xs text-text-muted font-normal">({totalCount})</span>
          <Icon
            name={expanded ? 'expand_less' : 'expand_more'}
            size={18}
            className="text-text-muted"
          />
        </span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {grouped.map((g) => (
          <span
            key={g.label}
            className="text-[11px] text-text-muted bg-fill-tertiary px-2 py-0.5 rounded-full"
          >
            {g.label}({g.apps.length})
          </span>
        ))}
      </div>

      {expanded && (
        <div className="space-y-5">
          {grouped.map((group) => (
            <AppSection key={group.label} title={group.label} apps={group.apps} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── SearchResults ─── */

function SearchResults({
  creationHits,
  appHits,
  onViewCreation,
}: {
  creationHits: MyCreation[];
  appHits: AppItem[];
  onViewCreation: (name: string) => void;
}) {
  if (creationHits.length === 0 && appHits.length === 0) {
    return <div className="text-center py-12 text-sm text-text-muted">没有匹配的应用</div>;
  }

  return (
    <div className="space-y-4">
      {creationHits.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wide">
            我的轻应用
          </h3>
          {creationHits.map((app) => (
            <button
              key={app.id}
              type="button"
              onClick={() => onViewCreation(app.name)}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-border bg-bg-card hover:shadow-md transition-shadow text-left"
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: `${app.color}14` }}
              >
                <Icon name={app.icon} size={20} style={{ color: app.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-text-primary truncate">{app.name}</p>
                <p className="text-[11px] text-text-muted">
                  {app.subLabel} · {app.updatedAt}
                </p>
              </div>
              <Icon name="chevron_right" size={18} className="text-text-muted shrink-0" />
            </button>
          ))}
        </div>
      )}
      {appHits.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wide">
            全部应用
          </h3>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-y-5 gap-x-4">
            {appHits.map((app) => (
              <button
                key={app.id}
                type="button"
                onClick={() =>
                  useToastStore.getState().addToast(`正在打开「${app.name}」…`, 'info')
                }
                className="group flex flex-col items-center gap-2 cursor-pointer"
              >
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-105"
                  style={{ background: `${app.color}12` }}
                >
                  <Icon name={app.icon} size={26} style={{ color: app.color }} />
                </div>
                <span className="text-xs text-text-primary font-medium text-center leading-tight line-clamp-1 max-w-[72px]">
                  {app.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── EmptyCreationGuide ─── */

function EmptyCreationGuide({ onCreateNew }: { onCreateNew: (rect: DOMRect) => void }) {
  return (
    <div className="flex flex-col items-center py-10 text-center space-y-4">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
        <Icon name="auto_awesome" size={32} className="text-primary" />
      </div>
      <div className="space-y-1.5">
        <p className="text-base font-semibold text-text-primary">用 AI 创建你的第一个轻应用</p>
        <p className="text-sm text-text-muted max-w-xs">描述你的需求，AI 帮你快速生成专属应用</p>
      </div>
      <button
        type="button"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          onCreateNew(rect);
        }}
        className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
      >
        <Icon name="auto_awesome" size={18} />
        开始创建
      </button>
    </div>
  );
}
