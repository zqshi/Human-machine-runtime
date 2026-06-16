import { useState, useEffect, useCallback, useRef } from 'react';
import { skillApi } from '../../../application/services/adminApi';
import { FilterBar } from '../../components/ui/FilterBar';
import { StatCard } from '../../components/ui/StatCard';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { Icon } from '../../components/ui/Icon';
import { SkillDetailDrawer } from './SkillDetailDrawer';
import { SkillPolicyDrawer } from './SkillPolicyDrawer';

const STATUS_BADGE: Record<string, string> = {
  approved: 'bg-green-50 text-green-700',
  active: 'bg-green-50 text-green-700',
  published: 'bg-green-50 text-green-700',
  pending: 'bg-yellow-50 text-yellow-700',
  review: 'bg-yellow-50 text-yellow-700',
  draft: 'bg-gray-100 text-gray-500',
  rejected: 'bg-red-50 text-red-700',
};

const FILTER_DEFS = [
  { key: 'keyword', label: '搜索', type: 'text' as const, placeholder: '名称/ID' },
  {
    key: 'source',
    label: '来源',
    type: 'select' as const,
    options: [
      { value: 'builtin', label: '内置' },
      { value: 'user', label: '用户' },
      { value: 'marketplace', label: '市场' },
    ],
  },
  {
    key: 'status',
    label: '状态',
    type: 'select' as const,
    options: [
      { value: 'active', label: '活跃' },
      { value: 'pending', label: '待审' },
      { value: 'draft', label: '草稿' },
      { value: 'rejected', label: '已拒' },
    ],
  },
];

type DrawerState = { mode: 'none' } | { mode: 'detail'; id: string } | { mode: 'policy' };

export function SkillsSection() {
  const [skills, setSkills] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [drawer, setDrawer] = useState<DrawerState>({ mode: 'none' });
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // filters 变化时在渲染阶段标记 loading（避免 useEffect 中同步 setState）
  const [prevFilters, setPrevFilters] = useState(filters);
  if (filters !== prevFilters) {
    setPrevFilters(filters);
    setLoading(true);
  }

  // 拉取数据（不含 setLoading，供 effect 使用）
  const fetchSkills = useCallback(() => {
    skillApi
      .list({
        keyword: filters.keyword || undefined,
        source: filters.source || undefined,
        name: filters.name || undefined,
        employeeId: filters.employeeId || undefined,
      })
      .then((r) => setSkills(r.skills || []))
      .catch(() => setSkills([]))
      .finally(() => setLoading(false));
  }, [filters]);

  // 供手动刷新用（带 loading 态）
  const loadSkills = useCallback(() => {
    setLoading(true);
    fetchSkills();
  }, [fetchSkills]);

  useEffect(fetchSkills, [fetchSkills]);

  const filtered = skills.filter((s) => {
    const status = s.moderationStatus || s.status;
    if (filters.status && status !== filters.status) return false;
    return true;
  });

  const handleAction = async (id: string, action: string) => {
    try {
      if (action === 'delete') {
        setDeleteTarget(id);
        return;
      }
      if (action === 'approve') await skillApi.update(id, { status: 'active' });
      else if (action === 'reject') await skillApi.update(id, { status: 'rejected' });
      else if (action === 'publish') await skillApi.update(id, { status: 'published' });
      loadSkills();
    } catch {
      /* ignore */
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await skillApi.delete(deleteTarget);
      loadSkills();
    } catch {
      /* ignore */
    }
    setDeleting(false);
    setDeleteTarget(null);
  };

  const handleExport = async () => {
    try {
      const data = await skillApi.exportAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'skills-export.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await skillApi.importBatch(data);
      loadSkills();
    } catch {
      /* ignore */
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const stats = {
    total: skills.length,
    active: skills.filter(
      (s) =>
        s.moderationStatus === 'approved' ||
        s.moderationStatus === 'active' ||
        s.status === 'active' ||
        s.status === 'published'
    ).length,
    pending: skills.filter(
      (s) =>
        s.moderationStatus === 'pending' ||
        s.moderationStatus === 'review' ||
        s.status === 'pending'
    ).length,
  };

  return (
    <div className="p-6 space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="技能总数" value={stats.total} icon="psychology" />
        <StatCard label="活跃" value={stats.active} icon="check_circle" color="#34C759" />
        <StatCard label="待审" value={stats.pending} icon="pending" color="#FF9500" />
      </div>

      <div className="flex items-center justify-between">
        <FilterBar
          filters={FILTER_DEFS}
          values={filters}
          onChange={(k, v) => setFilters((p) => ({ ...p, [k]: v }))}
          onSearch={loadSkills}
        />
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDrawer({ mode: 'policy' })}
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
          >
            沉淀策略
          </button>
          <button
            onClick={handleExport}
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
          >
            <Icon name="download" size={14} className="mr-1 align-[-2px]" />
            导出
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
          >
            <Icon name="upload" size={14} className="mr-1 align-[-2px]" />
            导入
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.zip"
            className="hidden"
            onChange={handleImport}
          />
          <button
            onClick={loadSkills}
            className="p-1.5 text-gray-400 hover:text-[#007AFF]"
            title="刷新"
          >
            <Icon name="refresh" size={16} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-gray-400 text-sm">加载中...</div>
      ) : (
        <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">技能</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">分类</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">来源</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">版本</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">调用量</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">状态</th>
                <th className="text-right px-4 py-2.5 font-medium text-gray-500">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((skill, idx) => {
                const id = String(skill.slug || skill.id || idx);
                const name = String(skill.displayName || skill.name || id);
                const status = String(skill.moderationStatus || skill.status || '—');
                const version = (skill.latestVersion as Record<string, unknown>)?.version;
                const downloads = (skill.stats as Record<string, unknown>)?.totalDownloads;
                const tags = skill.tags as string[] | undefined;

                return (
                  <tr
                    key={id}
                    className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => setDrawer({ mode: 'detail', id })}
                  >
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-gray-800">{name}</div>
                      <div className="text-xs text-gray-400">{id}</div>
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">
                      {tags?.length ? tags.join(', ') : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">{String(skill.source || '—')}</td>
                    <td className="px-4 py-2.5 text-gray-600">v{String(version || '1.0')}</td>
                    <td className="px-4 py-2.5 text-gray-600">
                      {downloads != null ? String(downloads) : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex px-2 py-0.5 text-xs rounded-full ${STATUS_BADGE[status] || 'bg-gray-100 text-gray-500'}`}
                      >
                        {status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right" onClick={(ev) => ev.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        {status === 'pending' && (
                          <>
                            <ActionBtn
                              icon="check"
                              title="通过"
                              onClick={() => handleAction(id, 'approve')}
                            />
                            <ActionBtn
                              icon="close"
                              title="拒绝"
                              onClick={() => handleAction(id, 'reject')}
                            />
                          </>
                        )}
                        {status === 'active' && (
                          <ActionBtn
                            icon="publish"
                            title="发布"
                            onClick={() => handleAction(id, 'publish')}
                          />
                        )}
                        <ActionBtn
                          icon="delete"
                          title="删除"
                          onClick={() => handleAction(id, 'delete')}
                          danger
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    暂无技能
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <SkillDetailDrawer
        open={drawer.mode === 'detail'}
        skillId={drawer.mode === 'detail' ? drawer.id : null}
        onClose={() => setDrawer({ mode: 'none' })}
      />

      <SkillPolicyDrawer
        open={drawer.mode === 'policy'}
        onClose={() => setDrawer({ mode: 'none' })}
      />

      <ConfirmModal
        open={!!deleteTarget}
        title="删除技能"
        message="确定要删除该技能？此操作不可恢复。"
        danger
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function ActionBtn({
  icon,
  title,
  onClick,
  danger,
}: {
  icon: string;
  title: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`p-1 ${danger ? 'text-gray-400 hover:text-red-500' : 'text-gray-400 hover:text-[#007AFF]'}`}
      title={title}
    >
      <Icon name={icon} size={16} />
    </button>
  );
}
