import { useState, useEffect, useCallback } from 'react';
import { openclawConfigApi } from '../../../application/services/adminApi';
import type { OpenclawConfig, ConfigSnapshot } from '../../../application/services/adminApi';
import { Icon } from '../../components/ui/Icon';

const inputCls =
  'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] font-mono';
const labelCls = 'block text-xs text-gray-400 mb-1';

export function MonitorConfigPanel() {
  const [_config, setConfig] = useState<OpenclawConfig | null>(null);
  const [snapshots, setSnapshots] = useState<ConfigSnapshot[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ text: string; error: boolean } | null>(null);
  const [diffSnapshotId, setDiffSnapshotId] = useState<string | null>(null);

  const [image, setImage] = useState('');
  const [version, setVersion] = useState('');
  const [sourcePath, setSourcePath] = useState('');
  const [ttl, setTtl] = useState('90');
  const [maxRows, setMaxRows] = useState('100000');
  const [ringSize, setRingSize] = useState('3');
  const [archiveEnabled, setArchiveEnabled] = useState(true);
  const [allowlist, setAllowlist] = useState('');
  const [approvalJson, setApprovalJson] = useState('');

  const showStatus = (text: string, error = false) => {
    setStatus({ text, error });
    setTimeout(() => setStatus(null), 5000);
  };

  const loadConfig = useCallback(async () => {
    try {
      const data = await openclawConfigApi.get();
      setConfig(data);
      const rt = data.runtime || {};
      const tpl = data.permissionTemplate || {};
      const ret = data.retention || {};
      setImage(rt.openclawImage || '');
      setVersion(rt.openclawRuntimeVersion || '');
      setSourcePath(rt.openclawSourcePath || '');
      setTtl(String(ret.auditLogTtlDays ?? 90));
      setMaxRows(String(ret.auditLogMaxRows ?? 100000));
      setRingSize(String(ret.archiveRingSize ?? 3));
      setArchiveEnabled(ret.archiveEnabled !== false);
      setAllowlist(Array.isArray(tpl.commandAllowlist) ? tpl.commandAllowlist.join('\n') : '');
      setApprovalJson(tpl.approvalByRisk ? JSON.stringify(tpl.approvalByRisk, null, 2) : '{}');
    } catch (err) {
      showStatus(`加载失败: ${err instanceof Error ? err.message : '未知错误'}`, true);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const data = await openclawConfigApi.snapshots();
      setSnapshots(data.snapshots || []);
    } catch {
      setSnapshots([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    openclawConfigApi.get().then((data) => {
      if (cancelled) return;
      setConfig(data);
      const rt = data.runtime || {};
      const tpl = data.permissionTemplate || {};
      const ret = data.retention || {};
      setImage(rt.openclawImage || '');
      setVersion(rt.openclawRuntimeVersion || '');
      setSourcePath(rt.openclawSourcePath || '');
      setTtl(String(ret.auditLogTtlDays ?? 90));
      setMaxRows(String(ret.auditLogMaxRows ?? 100000));
      setRingSize(String(ret.archiveRingSize ?? 3));
      setArchiveEnabled(ret.archiveEnabled !== false);
      setAllowlist(Array.isArray(tpl.commandAllowlist) ? tpl.commandAllowlist.join('\n') : '');
      setApprovalJson(tpl.approvalByRisk ? JSON.stringify(tpl.approvalByRisk, null, 2) : '{}');
    }).catch((err) => {
      if (!cancelled) showStatus(`加载失败: ${err instanceof Error ? err.message : '未知错误'}`, true);
    });
    return () => { cancelled = true; };
  }, []);

  const handleSave = async () => {
    let approvalByRisk: Record<string, unknown> = {};
    const raw = approvalJson.trim();
    if (raw) {
      try {
        approvalByRisk = JSON.parse(raw);
      } catch {
        showStatus('审批模板 JSON 格式不正确', true);
        return;
      }
    }
    setSaving(true);
    try {
      await openclawConfigApi.save({
        runtime: {
          openclawImage: image.trim(),
          openclawRuntimeVersion: version.trim(),
          openclawSourcePath: sourcePath.trim(),
        },
        permissionTemplate: {
          commandAllowlist: allowlist
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean),
          approvalByRisk,
        },
        retention: {
          auditLogTtlDays: Number(ttl) || 90,
          auditLogMaxRows: Number(maxRows) || 100000,
          archiveEnabled,
          archiveRingSize: Number(ringSize) || 3,
        },
      });
      showStatus('配置已保存');
      await loadConfig();
      if (showHistory) loadHistory();
    } catch (err) {
      showStatus(`保存失败: ${err instanceof Error ? err.message : '未知错误'}`, true);
    } finally {
      setSaving(false);
    }
  };

  const handleRestore = async (id: string) => {
    try {
      await openclawConfigApi.restore(id);
      showStatus('已恢复到该版本');
      await loadConfig();
      loadHistory();
    } catch (err) {
      showStatus(`恢复失败: ${err instanceof Error ? err.message : '未知错误'}`, true);
    }
  };

  const toggleHistory = () => {
    const next = !showHistory;
    setShowHistory(next);
    if (next) loadHistory();
  };

  const diffSnapshot = snapshots.find((s) => s.id === diffSnapshotId);

  return (
    <div className="space-y-4">
      {/* 运行时配置 + 审计保留策略 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="border border-gray-200 rounded-xl p-4 bg-white">
          <h3 className="text-xs text-gray-400 mb-3">
            <Icon name="settings" size={14} className="mr-1 align-[-2px]" />
            运行时配置
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>OpenClaw 镜像</label>
              <input
                type="text"
                value={image}
                onChange={(e) => setImage(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>OpenClaw 版本</label>
              <input
                type="text"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                className={inputCls}
              />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>锁定源码路径</label>
              <input
                type="text"
                value={sourcePath}
                onChange={(e) => setSourcePath(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>
        </div>

        <div className="border border-gray-200 rounded-xl p-4 bg-white">
          <h3 className="text-xs text-gray-400 mb-3">
            <Icon name="archive" size={14} className="mr-1 align-[-2px]" />
            审计保留策略
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>日志保留天数 (TTL)</label>
              <input
                type="number"
                min={1}
                value={ttl}
                onChange={(e) => setTtl(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>最大行数</label>
              <input
                type="number"
                min={1000}
                step={1000}
                value={maxRows}
                onChange={(e) => setMaxRows(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>归档环大小</label>
              <input
                type="number"
                min={1}
                max={10}
                value={ringSize}
                onChange={(e) => setRingSize(e.target.value)}
                className={inputCls}
              />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={archiveEnabled}
                  onChange={(e) => setArchiveEnabled(e.target.checked)}
                  className="rounded border-gray-300"
                />
                启用自动归档
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* 权限模板 */}
      <div className="border border-gray-200 rounded-xl p-4 bg-white">
        <h3 className="text-xs text-gray-400 mb-3">
          <Icon name="security" size={14} className="mr-1 align-[-2px]" />
          默认权限模板
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>默认命令白名单（每行一个）</label>
            <textarea
              value={allowlist}
              onChange={(e) => setAllowlist(e.target.value)}
              rows={4}
              className={`${inputCls} resize-y`}
            />
          </div>
          <div>
            <label className={labelCls}>默认审批模板（JSON）</label>
            <textarea
              value={approvalJson}
              onChange={(e) => setApprovalJson(e.target.value)}
              rows={4}
              className={`${inputCls} resize-y`}
            />
          </div>
        </div>
      </div>

      {/* 操作栏 */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 text-sm font-medium text-white bg-[#007AFF] rounded-lg hover:bg-[#0066DD] transition-colors disabled:opacity-50"
        >
          {saving ? '保存中...' : '保存配置'}
        </button>
        <button
          onClick={() => {
            loadConfig();
            showStatus('已重新加载');
          }}
          className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
        >
          重新加载
        </button>
        <button
          onClick={toggleHistory}
          className={`px-4 py-2 text-sm border rounded-lg transition-colors ${showHistory ? 'border-[#007AFF] text-[#007AFF] bg-[#007AFF]/5' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}
        >
          版本历史
        </button>
        {status && (
          <span className={`text-xs ${status.error ? 'text-red-600' : 'text-green-600'}`}>
            {status.text}
          </span>
        )}
      </div>

      {/* 版本历史 */}
      {showHistory && (
        <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-medium text-gray-800">配置版本历史</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50/60">
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-2 font-medium text-gray-500 text-xs">版本</th>
                <th className="text-left px-4 py-2 font-medium text-gray-500 text-xs">时间</th>
                <th className="text-left px-4 py-2 font-medium text-gray-500 text-xs">操作人</th>
                <th className="text-right px-4 py-2 font-medium text-gray-500 text-xs">操作</th>
              </tr>
            </thead>
            <tbody>
              {snapshots.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-6 text-xs text-gray-400">
                    暂无历史版本
                  </td>
                </tr>
              ) : (
                snapshots.map((s) => (
                  <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-2 text-xs font-mono text-gray-600">
                      {s.id.slice(0, 12)}
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-500">
                      {s.savedAt
                        ? new Date(s.savedAt).toLocaleString('zh-CN', { hour12: false })
                        : '—'}
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-500">{s.actor || '—'}</td>
                    <td className="px-4 py-2 text-right">
                      <button
                        onClick={() => setDiffSnapshotId(diffSnapshotId === s.id ? null : s.id)}
                        className="text-xs text-[#007AFF] hover:underline mr-2"
                      >
                        {diffSnapshotId === s.id ? '收起' : 'Diff'}
                      </button>
                      <button
                        onClick={() => handleRestore(s.id)}
                        className="text-xs text-orange-600 hover:underline"
                      >
                        恢复
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {diffSnapshot && (
            <div className="px-4 py-3 border-t border-gray-100">
              <h4 className="text-xs font-medium text-gray-700 mb-2">配置快照</h4>
              <pre className="text-[11px] font-mono bg-gray-50 border border-gray-100 rounded-lg p-3 max-h-[240px] overflow-auto whitespace-pre-wrap break-all">
                {JSON.stringify(diffSnapshot.config, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
