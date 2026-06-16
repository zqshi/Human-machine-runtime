import { useState } from 'react';
import { Drawer } from '../../components/ui/Drawer';
import { Icon } from '../../components/ui/Icon';
import { useAdminStore } from '../../../application/stores/adminStore';
import { employeeDetailApi } from '../../../application/services/adminApi';
import { EmployeeMemoryStatus } from './EmployeeMemoryStatus';

interface Props {
  open: boolean;
  detail: Record<string, unknown> | null;
  onClose: () => void;
  onEdit: () => void;
}

function Section({
  title,
  icon,
  children,
  defaultOpen = true,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-gray-50/60 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
      >
        <Icon name={icon} size={16} className="text-gray-400" />
        <span className="flex-1 text-left">{title}</span>
        <Icon name={open ? 'expand_less' : 'expand_more'} size={16} className="text-gray-400" />
      </button>
      {open && <div className="p-3 space-y-2">{children}</div>}
    </div>
  );
}

function KV({ label, value }: { label: string; value: unknown }) {
  const display =
    value === null || value === undefined || value === ''
      ? '—'
      : typeof value === 'object'
        ? JSON.stringify(value, null, 2)
        : String(value);
  return (
    <div>
      <dt className="text-[11px] text-gray-400">{label}</dt>
      <dd className="text-sm text-gray-800 font-medium">{display}</dd>
    </div>
  );
}

function TagList({ items, empty = '—' }: { items: unknown; empty?: string }) {
  if (!Array.isArray(items) || items.length === 0)
    return <span className="text-xs text-gray-400">{empty}</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((t, i) => (
        <span
          key={i}
          className="inline-flex px-2 py-0.5 text-xs rounded-full bg-blue-50 text-blue-700"
        >
          {String(t)}
        </span>
      ))}
    </div>
  );
}

function formatDate(v: unknown): string {
  if (!v) return '-';
  try {
    return new Date(String(v)).toLocaleString('zh-CN');
  } catch {
    return String(v);
  }
}

function resolveSettings(d: Record<string, unknown>): Record<string, unknown> {
  const profile = (d.profile || {}) as Record<string, unknown>;
  return (profile.settings || {}) as Record<string, unknown>;
}

function resolveRuntime(d: Record<string, unknown>): Record<string, unknown> {
  const settings = resolveSettings(d);
  return (settings.runtimeProfile || d.runtimeProfile || d.runtime || {}) as Record<string, unknown>;
}

export function EmployeeDetailDrawer({ open, detail, onClose, onEdit }: Props) {
  const [showRawJson, setShowRawJson] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishMsg, setPublishMsg] = useState<{ text: string; ok: boolean } | null>(null);
  if (!detail) return null;

  const d = detail;
  const settings = resolveSettings(d);
  const runtimeProfile = resolveRuntime(d);

  const selectedTools = Array.isArray(settings.capabilities)
    ? settings.capabilities
    : Array.isArray(runtimeProfile.toolScope)
      ? runtimeProfile.toolScope
      : d.linkedToolIds;
  const selectedSkills = settings.linkedSkillIds || d.linkedSkillIds || d.skills;

  const rawVersions = Array.isArray(settings.versions)
    ? settings.versions
    : Array.isArray(d.versions)
      ? d.versions
      : [];
  const versions = (rawVersions as Record<string, unknown>[]).map((v) => ({
    version: String(v.version || '-'),
    status: String(v.status || 'draft'),
    date: v.date ? new Date(String(v.date)).toLocaleDateString('zh-CN') : '-',
  }));

  const handlePublishVersion = async (versionIndex: number) => {
    const employeeId = String(d.id || '');
    if (!employeeId) return;
    setPublishing(true);
    setPublishMsg(null);
    try {
      const updatedVersions = versions.map((v, i) =>
        i === versionIndex ? { ...v, status: 'published' } : v
      );
      await employeeDetailApi.updateProfile(employeeId, { versions: updatedVersions });
      setPublishMsg({ text: `版本 ${versions[versionIndex].version} 已发布`, ok: true });
    } catch (e) {
      setPublishMsg({ text: `发布失败：${(e as Error).message}`, ok: false });
    } finally {
      setPublishing(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={`员工详情 · ${String(d.id || '-')}`}
      width="w-[560px]"
    >
      <div className="space-y-3">
        {/* 操作栏 */}
        <div className="flex items-center gap-2">
          <button
            onClick={onEdit}
            className="px-3 py-1.5 text-xs bg-[#007AFF] text-white rounded-lg hover:bg-[#0066DD] transition-colors"
          >
            <Icon name="edit" size={14} className="mr-1 align-[-2px]" />
            编辑
          </button>
          <button
            onClick={() => useAdminStore.getState().setSection('eval-experiments')}
            className="px-3 py-1.5 text-xs border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Icon name="speed" size={14} className="mr-1 align-[-2px]" />
            评测记录
          </button>
          <button
            onClick={() => useAdminStore.getState().setSection('employee-memory')}
            className="px-3 py-1.5 text-xs border border-purple-200 text-purple-600 rounded-lg hover:bg-purple-50 transition-colors"
          >
            <Icon name="psychology" size={14} className="mr-1 align-[-2px]" />
            记忆库
          </button>
        </div>

        {/* 1. 基础信息 */}
        <Section title="基础信息" icon="info">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            <KV label="员工名称" value={d.displayName || d.name} />
            <KV label="归属部门" value={d.department} />
            <KV label="负责人" value={d.ownerId || d.enterpriseUserId} />
            <KV label="绑定 Channel 应用" value={d.channelName || d.channelAppId || d.channelId} />
            <KV label="Agent Runtime" value={d.agentRuntime || runtimeProfile.agentRuntime} />
            <KV label="默认模型" value={d.model || runtimeProfile.modelId} />
          </dl>
          <div className="mt-2">
            <div className="text-[11px] text-gray-400 mb-1">描述</div>
            <div className="text-sm text-gray-700 whitespace-pre-wrap">
              {String(d.description || d.personality || '—')}
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-gray-100">
            <EmployeeMemoryStatus employeeId={String(d.id || '')} employeeName={String(d.displayName || d.name || '')} />
          </div>
        </Section>

        {/* 2. 能力配置 */}
        <Section title="能力配置" icon="extension">
          <div>
            <div className="text-[11px] text-gray-400 mb-1">已选工具</div>
            <TagList items={selectedTools} empty="未配置" />
          </div>
          <div className="mt-2">
            <div className="text-[11px] text-gray-400 mb-1">已选 Skill</div>
            <TagList items={selectedSkills} empty="未配置" />
          </div>
          <details className="mt-2">
            <summary className="text-xs text-[#007AFF] cursor-pointer hover:underline">
              System Prompt
            </summary>
            <pre className="mt-1 text-xs font-mono bg-gray-50 p-2 rounded border border-gray-100 whitespace-pre-wrap max-h-40 overflow-y-auto">
              {String(runtimeProfile.systemPrompt || '未配置')}
            </pre>
          </details>
        </Section>

        {/* 3. 评测配置 */}
        <Section title="评测配置" icon="fact_check" defaultOpen={false}>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            <KV label="评测集" value={d.evalSuiteName || d.evalSuiteId} />
            <KV
              label="创建后基线评测"
              value={d.runBaselineAfterCreate ? '已启用' : '未启用'}
            />
            <KV label="最近评测状态" value={d.latestEvalStatus} />
            <KV label="最近评测时间" value={formatDate(d.latestEvalAt)} />
          </dl>
          <button
            onClick={() => useAdminStore.getState().setSection('eval-experiments')}
            className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs text-[#007AFF] border border-[#007AFF]/20 rounded-lg hover:bg-[#007AFF]/5 transition-colors"
          >
            <Icon name="speed" size={14} />
            查看评测看板
          </button>
        </Section>

        {/* 4. 版本管理 */}
        <Section title="版本管理" icon="new_releases" defaultOpen={false}>
          {publishMsg && (
            <div className={`text-xs px-3 py-2 rounded-lg ${publishMsg.ok ? 'text-green-700 bg-green-50' : 'text-red-600 bg-red-50'}`}>
              {publishMsg.text}
            </div>
          )}
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            <KV label="当前版本" value={versions.length > 0 ? versions[versions.length - 1].version : (d.versionName || d.currentVersion || d.version)} />
            <KV label="发布状态" value={versions.some((v) => v.status === 'published') ? '已发布' : (d.versionStatus || '草稿')} />
          </dl>
          <div className="mt-2">
            <div className="text-[11px] text-gray-400 mb-1">版本说明</div>
            <div className="text-sm text-gray-700 whitespace-pre-wrap">
              {String(d.releaseNote || '—')}
            </div>
          </div>
          {versions.length > 0 && (
            <div className="mt-3">
              <div className="text-[11px] text-gray-400 mb-2">版本历史</div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {versions.map((v, i) => {
                  const status = v.status;
                  return (
                    <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 border border-gray-100 rounded-lg text-xs">
                      <span className="font-mono font-semibold text-gray-700">{v.version}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          status === 'published'
                            ? 'bg-green-50 text-green-700'
                            : status === 'review'
                              ? 'bg-yellow-50 text-yellow-700'
                              : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {status === 'published' ? '已发布' : status === 'review' ? '审核中' : '草稿'}
                      </span>
                      <span className="text-gray-400 ml-auto text-[10px]">{v.date}</span>
                      {status !== 'published' && (
                        <button
                          onClick={() => handlePublishVersion(i)}
                          disabled={publishing}
                          className="px-2 py-0.5 text-[10px] font-medium text-[#007AFF] border border-[#007AFF]/30 rounded hover:bg-[#007AFF]/5 transition-colors disabled:opacity-40"
                        >
                          发布
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Section>

        {/* 原始 JSON */}
        <div className="mt-2">
          <button
            onClick={() => setShowRawJson(!showRawJson)}
            className="text-xs text-[#007AFF] hover:underline"
          >
            {showRawJson ? '收起原始 JSON' : '查看原始 JSON'}
          </button>
          {showRawJson && (
            <pre className="mt-2 text-xs font-mono bg-gray-50 p-3 rounded border border-gray-100 overflow-x-auto max-h-60 overflow-y-auto">
              {JSON.stringify(detail, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </Drawer>
  );
}
