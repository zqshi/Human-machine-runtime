import { useState, useEffect, useCallback, useMemo } from 'react';
import { aiGatewayApi } from '../../../application/services/adminApi';
import { Drawer } from '../../components/ui/Drawer';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { Icon } from '../../components/ui/Icon';

const SEVERITY_BADGE: Record<string, string> = {
  high: 'bg-red-50 text-red-600',
  medium: 'bg-yellow-50 text-yellow-700',
  low: 'bg-gray-100 text-gray-500',
};
const ACTION_BADGE: Record<string, string> = {
  block: 'bg-red-50 text-red-600',
  route_secure_model: 'bg-blue-50 text-blue-600',
  allow: 'bg-green-50 text-green-700',
};
const ACTION_LABELS: Record<string, string> = {
  block: '拦截',
  route_secure_model: '安全路由',
  allow: '放行',
};
const CATEGORY_LABELS: Record<string, string> = {
  '': '全部',
  security: '安全凭证',
  privacy: '个人隐私',
  company: '公司信息',
  custom: '自定义',
};

export function RiskRulesTab() {
  const [rules, setRules] = useState<Record<string, unknown>[]>([]);
  const [activeCategory, setActiveCategory] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Record<string, unknown> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [testText, setTestText] = useState('');
  const [testResult, setTestResult] = useState<Record<string, unknown> | null>(null);

  const load = useCallback(() => {
    aiGatewayApi
      .listRiskRules()
      .then((r) => setRules(r.rows || r.rules || []))
      .catch(() => {});
  }, []);
  useEffect(load, [load]);

  const filtered = activeCategory ? rules.filter((r) => r.category === activeCategory) : rules;

  const categoryCounts: Record<string, number> = { '': rules.length };
  for (const r of rules) {
    const cat = String(r.category || 'custom');
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  }

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await aiGatewayApi.deleteRiskRule(deleteTarget);
      load();
    } catch { /* intentionally ignored */ }
    setDeleting(false);
    setDeleteTarget(null);
  };

  const handleToggle = async (ruleId: string) => {
    try {
      await aiGatewayApi.toggleRiskRule(ruleId);
    } catch {
      /* ignore */
    }
    load();
  };

  const handleTest = async () => {
    if (!testText.trim()) return;
    const res = await aiGatewayApi.testRiskRules(testText.trim());
    setTestResult(res);
  };

  const handleExport = async () => {
    const res = await aiGatewayApi.exportRiskRules();
    const blob = new Blob([JSON.stringify(res.rules || [], null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'risk-rules-export.json';
    a.click();
  };

  return (
    <div className="space-y-3">
      {/* 工具栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setActiveCategory(k)}
              className={`px-3 py-1 text-xs rounded-lg transition-colors ${activeCategory === k ? 'bg-[#007AFF] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {label} ({categoryCounts[k] || 0})
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleExport}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            <Icon name="download" size={14} className="mr-1 align-[-2px]" />
            导出
          </button>
          <button
            onClick={() => {
              setEditTarget(null);
              setEditorOpen(true);
            }}
            className="px-3 py-1.5 text-xs bg-[#007AFF] text-white rounded-lg hover:bg-[#0066DD]"
          >
            <Icon name="add" size={14} className="mr-1 align-[-2px]" />
            新建规则
          </button>
        </div>
      </div>

      {/* 规则卡片 */}
      <div className="grid grid-cols-2 gap-3">
        {filtered.map((r) => (
          <div
            key={String(r.ruleId || r.id)}
            className="border border-gray-200 rounded-xl p-4 bg-white"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="font-medium text-sm text-gray-800">
                {String(r.displayName || r.name)}
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!r.isEnabled}
                  onChange={() => handleToggle(String(r.ruleId || r.id))}
                  className="sr-only peer"
                />
                <div className="w-8 h-4 bg-gray-300 rounded-full peer peer-checked:bg-[#007AFF] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-4"></div>
              </label>
            </div>
            <div className="text-xs text-gray-500 mb-2">{String(r.description || '')}</div>
            <div className="font-mono text-[11px] text-gray-400 bg-gray-50 rounded px-2 py-1 mb-2 truncate">
              {String(r.pattern || '')}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
                {String(r.category || 'custom')}
              </span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full ${SEVERITY_BADGE[String(r.severity)] || 'bg-gray-100 text-gray-500'}`}
              >
                {String(r.severity || '—')}
              </span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full ${ACTION_BADGE[String(r.action)] || 'bg-gray-100 text-gray-500'}`}
              >
                {ACTION_LABELS[String(r.action)] || String(r.action || '—')}
              </span>
              <div className="ml-auto flex items-center gap-1">
                <button
                  onClick={() => {
                    setEditTarget(r);
                    setEditorOpen(true);
                  }}
                  className="p-1 text-gray-400 hover:text-[#007AFF]"
                  title="编辑"
                >
                  <Icon name="edit" size={14} />
                </button>
                <button
                  onClick={() => setDeleteTarget(String(r.ruleId || r.id))}
                  className="p-1 text-gray-400 hover:text-red-500"
                  title="删除"
                >
                  <Icon name="delete" size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-2 flex items-center justify-center py-12 text-gray-400 text-sm">
            暂无规则
          </div>
        )}
      </div>

      {/* 规则测试 */}
      <div className="border border-gray-200 rounded-xl p-4 bg-white">
        <h3 className="text-sm font-medium text-gray-700 mb-2">规则测试</h3>
        <div className="flex gap-2">
          <textarea
            value={testText}
            onChange={(e) => setTestText(e.target.value)}
            placeholder="输入文本测试风险规则命中情况（支持多行批量测试）"
            rows={2}
            className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg resize-y font-mono"
          />
          <button
            onClick={handleTest}
            className="px-4 py-2 text-sm bg-[#007AFF] text-white rounded-lg hover:bg-[#0066DD] self-end"
          >
            测试
          </button>
        </div>
        {testResult && (
          <div
            className={`mt-2 p-3 rounded-lg text-xs ${(testResult.hits as unknown[])?.length ? 'bg-red-50 border border-red-100' : 'bg-green-50 border border-green-100'}`}
          >
            {(testResult.hits as unknown[])?.length ? (
              <div>
                <span className="font-medium text-red-700">
                  检测到 {(testResult.hits as unknown[]).length} 条风险命中
                </span>
              </div>
            ) : (
              <span className="text-green-700">未检测到风险，所有规则均通过。</span>
            )}
          </div>
        )}
      </div>

      {editorOpen && (
        <RuleEditor
          rule={editTarget}
          onClose={() => setEditorOpen(false)}
          onSaved={() => {
            setEditorOpen(false);
            load();
          }}
        />
      )}
      <ConfirmModal
        open={!!deleteTarget}
        title="删除规则"
        message="确定要删除该风控规则吗？"
        danger
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function RuleEditor({
  rule,
  onClose,
  onSaved,
}: {
  rule: Record<string, unknown> | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  // 根据 rule prop 派生初始表单值（渲染阶段计算，避免 useEffect 中 setState）
  const derivedForm = useMemo(
    () =>
      rule
        ? {
            ruleId: String(rule.ruleId || ''),
            displayName: String(rule.displayName || rule.name || ''),
            description: String(rule.description || ''),
            category: String(rule.category || 'custom'),
            pattern: String(rule.pattern || ''),
            severity: String(rule.severity || 'medium'),
            action: String(rule.action || 'route_secure_model'),
          }
        : {
            ruleId: '',
            displayName: '',
            description: '',
            category: 'custom',
            pattern: '',
            severity: 'medium',
            action: 'route_secure_model',
          },
    [rule]
  );
  const [form, setForm] = useState(derivedForm);
  const [prevRule, setPrevRule] = useState(rule);
  if (rule !== prevRule) {
    setPrevRule(rule);
    setForm(derivedForm);
  }
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.ruleId.trim() || !form.pattern.trim()) return;
    setSaving(true);
    try {
      if (rule) await aiGatewayApi.updateRiskRule(String(rule.ruleId || rule.id), form);
      else await aiGatewayApi.createRiskRule(form);
      onSaved();
    } catch { /* intentionally ignored */ }
    setSaving(false);
  };

  return (
    <Drawer open onClose={onClose} title={rule ? '编辑规则' : '新建规则'}>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-gray-500 block mb-0.5">规则 ID</label>
          <input
            value={form.ruleId}
            onChange={(e) => setForm((f) => ({ ...f, ruleId: e.target.value }))}
            placeholder="snake_case"
            readOnly={!!rule}
            className={`w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg font-mono ${rule ? 'opacity-60' : ''}`}
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-0.5">名称</label>
          <input
            value={form.displayName}
            onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
            className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-0.5">描述</label>
          <input
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-0.5">分类</label>
          <select
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg"
          >
            <option value="security">安全凭证</option>
            <option value="privacy">个人隐私</option>
            <option value="company">公司信息</option>
            <option value="custom">自定义</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-0.5">正则表达式</label>
          <textarea
            value={form.pattern}
            onChange={(e) => setForm((f) => ({ ...f, pattern: e.target.value }))}
            rows={3}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg font-mono resize-y"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 block mb-0.5">严重度</label>
            <select
              value={form.severity}
              onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value }))}
              className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg"
            >
              <option value="low">低</option>
              <option value="medium">中</option>
              <option value="high">高</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-0.5">命中动作</label>
            <select
              value={form.action}
              onChange={(e) => setForm((f) => ({ ...f, action: e.target.value }))}
              className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg"
            >
              <option value="allow">放行</option>
              <option value="route_secure_model">安全路由</option>
              <option value="block">拦截</option>
            </select>
          </div>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="w-full py-2 text-sm bg-[#007AFF] text-white rounded-lg hover:bg-[#0066DD] disabled:opacity-50"
        >
          {saving ? '保存中...' : '保存'}
        </button>
      </div>
    </Drawer>
  );
}
