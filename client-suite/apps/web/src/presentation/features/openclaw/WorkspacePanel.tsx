/**
 * WorkspacePanel — "造" 入口面板
 *
 * 展示用户的 workspace 列表 + 创建入口，嵌入 AttentionColumn A 栏 tab。
 */
import { useState, useEffect, useCallback } from 'react';
import { useWorkspaceStore } from '../../../application/stores/workspaceStore';
import { Icon } from '../../components/ui/Icon';
import type { WorkspaceDTO } from '../../../application/services/adminApi';

const TYPE_LABELS: Record<WorkspaceDTO['type'], string> = {
  APP: '应用',
  SKILL: '技能',
  NORMAL: '工作区',
  AGENT: 'Agent',
};

const TYPE_ICONS: Record<WorkspaceDTO['type'], string> = {
  APP: 'deployed_code',
  SKILL: 'bolt',
  NORMAL: 'folder',
  AGENT: 'smart_toy',
};

function WorkspaceCard({
  ws,
  isSelected,
  onClick,
}: {
  ws: WorkspaceDTO;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-lg border px-3 py-2.5 transition-colors ${
        isSelected
          ? 'border-primary/40 bg-primary/[0.08]'
          : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05]'
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <Icon name={TYPE_ICONS[ws.type] ?? 'folder'} size={14} className="text-primary/70" />
        <span className="text-xs font-medium text-slate-200 truncate flex-1">{ws.name}</span>
        <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.06] text-slate-400">
          {TYPE_LABELS[ws.type] ?? ws.type}
        </span>
      </div>
      {ws.description && (
        <p className="text-[11px] text-slate-400 line-clamp-1 pl-5">{ws.description}</p>
      )}
      <p className="text-[10px] text-slate-500 mt-1 pl-5">
        {ws.status === 'active' ? '活跃' : '已归档'} · 更新于{' '}
        {new Date(ws.updatedAt).toLocaleDateString('zh-CN')}
      </p>
    </button>
  );
}

export function WorkspacePanel() {
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const loading = useWorkspaceStore((s) => s.loading);
  const error = useWorkspaceStore((s) => s.error);
  const currentWorkspaceId = useWorkspaceStore((s) => s.currentWorkspaceId);
  const fetchWorkspaces = useWorkspaceStore((s) => s.fetchWorkspaces);
  const selectWorkspace = useWorkspaceStore((s) => s.selectWorkspace);
  const createWorkspace = useWorkspaceStore((s) => s.createWorkspace);

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<WorkspaceDTO['type']>('SKILL');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  const handleCreate = useCallback(async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const ws = await createWorkspace(newName.trim(), newType);
      selectWorkspace(ws.id);
      setShowCreate(false);
      setNewName('');
    } finally {
      setCreating(false);
    }
  }, [newName, newType, createWorkspace, selectWorkspace]);

  if (loading && workspaces.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500">
        <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin mb-2" />
        <p className="text-[11px]">加载中…</p>
      </div>
    );
  }

  if (error && workspaces.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 px-4">
        <Icon name="error_outline" size={24} className="text-red-400/60 mb-2" />
        <p className="text-[11px] text-center">{error}</p>
        <button
          type="button"
          onClick={fetchWorkspaces}
          className="mt-2 text-[10px] text-primary hover:text-primary/80"
        >
          重试
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto hmr-scrollbar">
      {/* Create button */}
      <div className="p-2">
        {!showCreate ? (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="w-full h-8 rounded-lg border border-dashed border-white/20 text-[11px] text-slate-400 hover:text-primary hover:border-primary/40 transition-colors flex items-center justify-center gap-1"
          >
            <Icon name="add" size={14} />
            新建工作区
          </button>
        ) : (
          <div className="rounded-lg border border-primary/30 bg-primary/[0.04] p-2.5 space-y-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder="工作区名称"
              className="w-full h-7 px-2 rounded border border-white/10 bg-white/[0.04] text-[11px] text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-primary/40"
              autoFocus
            />
            <div className="flex gap-1">
              {(['SKILL', 'AGENT', 'APP', 'NORMAL'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setNewType(t)}
                  className={`flex-1 h-6 rounded text-[10px] transition-colors ${
                    newType === t
                      ? 'bg-primary/20 text-primary border border-primary/30'
                      : 'bg-white/[0.04] text-slate-400 border border-white/10 hover:bg-white/[0.06]'
                  }`}
                >
                  {TYPE_LABELS[t]}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="flex-1 h-6 rounded text-[10px] text-slate-400 hover:text-slate-200 bg-white/[0.04]"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating || !newName.trim()}
                className="flex-1 h-6 rounded text-[10px] text-white bg-primary hover:bg-primary/90 disabled:opacity-40"
              >
                {creating ? '创建中…' : '创建'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Workspace list */}
      <div className="p-2 pt-0 space-y-1.5">
        {workspaces.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-slate-500">
            <Icon name="build" size={28} className="text-slate-600 mb-2" />
            <p className="text-[11px]">还没有工作区</p>
            <p className="text-[10px] text-slate-600">点击上方按钮开始创造</p>
          </div>
        ) : (
          workspaces.map((ws) => (
            <WorkspaceCard
              key={ws.id}
              ws={ws}
              isSelected={ws.id === currentWorkspaceId}
              onClick={() => selectWorkspace(ws.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
