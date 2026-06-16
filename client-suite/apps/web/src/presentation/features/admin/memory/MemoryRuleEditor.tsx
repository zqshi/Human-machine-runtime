import { useState, useEffect, useCallback } from 'react';
import {
  employeeMemoryApi,
  type MemoryStore,
  type MemoryRule,
} from '../../../../application/services/adminApi';
import { useToastStore } from '../../../../application/stores/toastStore';
import { Modal } from '../../../components/ui/Modal';
import { Icon } from '../../../components/ui/Icon';

interface Props {
  store: MemoryStore;
}

type RuleType = 'fragment_rule' | 'profile_rule' | 'consensus_rule';

type ConsensusTrigger = 'conversation_end' | 'feedback_received' | 'scheduled';

const RULE_TYPE_LABEL: Record<RuleType, string> = {
  fragment_rule: '片段规则',
  profile_rule: '画像规则',
  consensus_rule: '共识提取',
};

const CONSENSUS_TRIGGER_OPTIONS: { value: ConsensusTrigger; label: string }[] = [
  { value: 'conversation_end', label: '对话结束' },
  { value: 'feedback_received', label: '收到反馈' },
  { value: 'scheduled', label: '定时触发' },
];

/** 渲染共识提取规则配置摘要（触发条件 · 最低用户数 · 是否审核） */
function consensusSummary(rule: MemoryRule): string {
  const event = rule.trigger?.event;
  const eventLabel = CONSENSUS_TRIGGER_OPTIONS.find((o) => o.value === event)?.label ?? (event || '');
  const minUsers = rule.trigger?.conditions?.minUsers;
  const minUsersStr = typeof minUsers === 'number' ? ` · ≥${minUsers} 用户` : '';
  return `${eventLabel}${minUsersStr}`;
}

const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF]';

export function MemoryRuleEditor({ store }: Props) {
  const [rules, setRules] = useState<MemoryRule[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<{
    ruleType: RuleType;
    name: string;
    description: string;
    triggerEvent: ConsensusTrigger;
    minUsers: number;
  }>({
    ruleType: 'fragment_rule',
    name: '',
    description: '',
    triggerEvent: 'conversation_end',
    minUsers: 2,
  });
  const [addLoading, setAddLoading] = useState(false);

  const loadRules = useCallback(async () => {
    try {
      const list = await employeeMemoryApi.listRules(store.id);
      setRules(Array.isArray(list) ? list : []);
    } catch { setRules([]); }
  }, [store.id]);

  useEffect(() => { loadRules(); }, [loadRules]);

  const fragmentRules = rules.filter((r) => r.ruleType === 'fragment_rule');
  const profileRules = rules.filter((r) => r.ruleType === 'profile_rule');
  const consensusRules = rules.filter((r) => r.ruleType === 'consensus_rule');

  const handleAdd = async () => {
    if (!addForm.name.trim()) {
      useToastStore.getState().addToast('规则名称为必填', 'info');
      return;
    }
    setAddLoading(true);
    try {
      const payload: {
        ruleType: RuleType;
        name: string;
        description: string;
        trigger?: MemoryRule['trigger'];
        action?: MemoryRule['action'];
      } = {
        ruleType: addForm.ruleType,
        name: addForm.name.trim(),
        description: addForm.description.trim(),
      };
      if (addForm.ruleType === 'consensus_rule') {
        payload.trigger = {
          event: addForm.triggerEvent,
          conditions: { minUsers: addForm.minUsers },
        };
        payload.action = { type: 'consensus_extract' };
      }
      await employeeMemoryApi.createRule(store.id, payload);
      useToastStore.getState().addToast('规则已创建', 'success');
      setAddOpen(false);
      setAddForm({ ruleType: 'fragment_rule', name: '', description: '', triggerEvent: 'conversation_end', minUsers: 2 });
      loadRules();
    } catch (err) {
      useToastStore.getState().addToast(`创建失败：${err instanceof Error ? err.message : '未知'}`, 'error');
    } finally { setAddLoading(false); }
  };

  const handleToggle = async (rule: MemoryRule) => {
    try {
      await employeeMemoryApi.updateRule(store.id, rule.id, { enabled: !rule.enabled });
      loadRules();
    } catch (err) {
      useToastStore.getState().addToast(`更新失败：${err instanceof Error ? err.message : '未知'}`, 'error');
    }
  };

  const handleDelete = async (ruleId: string) => {
    try {
      await employeeMemoryApi.deleteRule(store.id, ruleId);
      useToastStore.getState().addToast('规则已删除', 'success');
      loadRules();
    } catch (err) {
      useToastStore.getState().addToast(`删除失败：${err instanceof Error ? err.message : '未知'}`, 'error');
    }
  };

  const renderRuleSection = (title: string, icon: string, ruleType: RuleType, items: MemoryRule[]) => (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-800 flex items-center gap-1.5">
          <Icon name={icon} size={16} />
          {title}
        </h4>
        <button
          onClick={() => { setAddForm({ ...addForm, ruleType }); setAddOpen(true); }}
          className="text-xs text-[#007AFF] hover:underline"
        >
          + 新增
        </button>
      </div>
      {items.length === 0 ? (
        <div className="text-xs text-gray-400 py-4 text-center border border-dashed border-gray-200 rounded-lg">暂无{title}</div>
      ) : (
        <div className="space-y-1">
          {items.map((rule) => (
            <div key={rule.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
              <button
                onClick={() => handleToggle(rule)}
                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                  rule.enabled ? 'border-[#007AFF] bg-[#007AFF]' : 'border-gray-300'
                }`}
              >
                {rule.enabled && <Icon name="check" size={12} className="text-white" />}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium text-gray-700 truncate">{rule.name}</span>
                  {ruleType === 'consensus_rule' && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] rounded-full bg-emerald-50 text-emerald-700 shrink-0">
                      <Icon name="groups" size={10} />共识
                    </span>
                  )}
                </div>
                {rule.description && (
                  <div className="text-[11px] text-gray-400 truncate">{rule.description}</div>
                )}
                {ruleType === 'consensus_rule' && rule.trigger?.event && (
                  <div className="text-[10px] text-gray-400 truncate">{consensusSummary(rule)}</div>
                )}
              </div>
              <button
                onClick={() => handleDelete(rule.id)}
                className="px-2 py-0.5 text-xs border border-red-200 text-red-600 rounded hover:bg-red-50"
              >
                删除
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>规则控制记忆的自动提取和画像更新行为</span>
        <span>{rules.length} 条规则</span>
      </div>

      {renderRuleSection('片段规则', 'segment', 'fragment_rule', fragmentRules)}
      {renderRuleSection('画像规则', 'person', 'profile_rule', profileRules)}
      {renderRuleSection('共识提取', 'groups', 'consensus_rule', consensusRules)}

      {/* Add Rule Modal — 简化：仅类型+名称+描述 */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="新增记忆规则" width="max-w-md">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">规则类型</label>
            <div className="px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg text-gray-700">
              {RULE_TYPE_LABEL[addForm.ruleType]}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">名称 *</label>
            <input type="text" value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} placeholder="例：从反馈中提取偏好" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">描述</label>
            <input type="text" value={addForm.description} onChange={(e) => setAddForm({ ...addForm, description: e.target.value })} placeholder="规则说明" className={inputCls} />
          </div>
          {addForm.ruleType === 'consensus_rule' && (
            <div className="space-y-3 p-3 rounded-lg bg-emerald-50/40 border border-emerald-100">
              <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                <Icon name="groups" size={14} />共识提取配置
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">触发条件</label>
                <select value={addForm.triggerEvent} onChange={(e) => setAddForm({ ...addForm, triggerEvent: e.target.value as ConsensusTrigger })} className={inputCls}>
                  {CONSENSUS_TRIGGER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">最低用户数（≥N 个用户出现相同记忆才提取）</label>
                <input type="number" min={2} max={100} value={addForm.minUsers} onChange={(e) => setAddForm({ ...addForm, minUsers: Number(e.target.value) })} className={inputCls} />
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setAddOpen(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">取消</button>
            <button onClick={handleAdd} disabled={addLoading} className="px-4 py-2 text-sm font-medium text-white bg-[#007AFF] rounded-lg hover:bg-[#0066DD] disabled:opacity-50">
              {addLoading ? '创建中...' : '创建'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
