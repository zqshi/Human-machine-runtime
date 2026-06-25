import { useState, useMemo, useEffect } from 'react';
import { aiGatewayApi } from '../../../application/services/adminApi';
import { Drawer } from '../../components/ui/Drawer';
import { ToggleSwitch } from '../../components/ui/ToggleSwitch';
import { Icon } from '../../components/ui/Icon';
import { AgentGrantsDrawer } from './AgentGrantsDrawer';

export interface ModelEditorProps {
  model: Record<string, unknown> | null;
  providers: Record<string, unknown>[];
  onClose: () => void;
  onSaved: () => void;
}

export function ModelEditor({ model, providers, onClose, onSaved }: ModelEditorProps) {
  const derivedForm = useMemo(
    () =>
      model
        ? {
            displayName: String(model.displayName || model.name || ''),
            modelName: String(model.modelName || ''),
            description: String(model.description || ''),
            providerType: String(model.providerType || 'anthropic'),
            protocolType: String(model.protocolType || 'openai'),
            baseUrl: String(model.baseUrl || ''),
            providerModelName: String(model.providerModelName || ''),
            apiKey: '',
            maxTokens: String(model.maxTokens ?? ''),
            timeout: String(model.timeout ?? ''),
            streamTimeout: String(model.streamTimeout ?? ''),
            rateLimitPerMin: String(model.rateLimitPerMin ?? '60'),
            inputPrice: String(model.inputPrice ?? '0'),
            outputPrice: String(model.outputPrice ?? '0'),
            cacheReadCost: String(model.cacheReadCost ?? ''),
            cacheCreationCost: String(model.cacheCreationCost ?? ''),
            currency: String(model.currency || 'USD'),
            isActive: model.isActive !== false,
          }
        : {
            displayName: '',
            modelName: '',
            description: '',
            providerType: 'anthropic',
            protocolType: 'anthropic',
            baseUrl: '',
            providerModelName: '',
            apiKey: '',
            maxTokens: '',
            timeout: '',
            streamTimeout: '',
            rateLimitPerMin: '60',
            inputPrice: '0',
            outputPrice: '0',
            cacheReadCost: '',
            cacheCreationCost: '',
            currency: 'USD',
            isActive: true,
          },
    [model]
  );
  const [form, setForm] = useState(derivedForm);
  const [prevModel, setPrevModel] = useState(model);
  if (model !== prevModel) {
    setPrevModel(model);
    setForm(derivedForm);
  }
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [grantCount, setGrantCount] = useState<number | null>(null);
  const [grantsDrawerOpen, setGrantsDrawerOpen] = useState(false);

  // 已保存模型：加载授权数
  useEffect(() => {
    if (!model) {
      setGrantCount(null);
      return;
    }
    const mid = String(model.id);
    aiGatewayApi
      .listModelGrants(mid)
      .then((r) => setGrantCount(r.grants.length))
      .catch(() => setGrantCount(null));
  }, [model]);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.displayName.trim()) e.displayName = '请输入显示名称';
    if (!form.providerModelName.trim()) e.providerModelName = '请输入供应商模型名';
    if (!form.baseUrl.trim()) e.baseUrl = '请输入 Base URL';
    if (!model && !form.apiKey.trim()) e.apiKey = '新建模型时请输入 API Key';
    if (form.maxTokens && Number(form.maxTokens) <= 0) e.maxTokens = '必须为正整数';
    if (form.timeout && Number(form.timeout) <= 0) e.timeout = '必须为正整数';
    if (form.streamTimeout && Number(form.streamTimeout) <= 0) e.streamTimeout = '必须为正整数';
    if (form.rateLimitPerMin && Number(form.rateLimitPerMin) <= 0)
      e.rateLimitPerMin = '必须为正整数';
    if (form.inputPrice && Number(form.inputPrice) < 0) e.inputPrice = '不能为负数';
    if (form.outputPrice && Number(form.outputPrice) < 0) e.outputPrice = '不能为负数';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        inputPrice: Number(form.inputPrice) || 0,
        outputPrice: Number(form.outputPrice) || 0,
        cacheReadCost: form.cacheReadCost ? Number(form.cacheReadCost) : undefined,
        cacheCreationCost: form.cacheCreationCost ? Number(form.cacheCreationCost) : undefined,
        maxTokens: form.maxTokens ? Number(form.maxTokens) : undefined,
        timeout: form.timeout ? Number(form.timeout) : undefined,
        streamTimeout: form.streamTimeout ? Number(form.streamTimeout) : undefined,
        rateLimitPerMin: form.rateLimitPerMin ? Number(form.rateLimitPerMin) : undefined,
      };
      if (model) await aiGatewayApi.updateModel(String(model.id), payload);
      else await aiGatewayApi.createModel(payload);
      onSaved();
    } catch {
      /* intentionally ignored */
    }
    setSaving(false);
  };

  const set = (k: string, v: string | boolean) => {
    setForm((f) => {
      const next = { ...f, [k]: v };
      if (k === 'providerType' && !model) {
        const p = providers.find((p) => String(p.id) === String(v));
        if (p) {
          next.baseUrl = String(p.baseUrl || f.baseUrl);
          next.protocolType = String(p.protocolType || f.protocolType);
        }
      }
      return next;
    });
    if (errors[k]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[k];
        return next;
      });
    }
  };

  return (
    <Drawer open onClose={onClose} title={model ? '编辑模型' : '添加模型'} width="w-[480px]">
      <div className="space-y-4">
        {/* ── 基础配置 ── */}
        <div className="space-y-3">
          <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider">基础配置</h4>

          <div>
            <label className="text-xs text-gray-500 block mb-0.5">
              供应商 <span className="text-red-500">*</span>
            </label>
            <select
              value={form.providerType}
              onChange={(e) => set('providerType', e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg"
            >
              {providers.map((p) => (
                <option key={String(p.id)} value={String(p.id)}>
                  {String(p.name)}
                </option>
              ))}
              <option value="custom">自定义</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-0.5">
              显示名称 <span className="text-red-500">*</span>
            </label>
            <input
              value={form.displayName}
              onChange={(e) => set('displayName', e.target.value)}
              placeholder="Claude Sonnet 4.6"
              className={`w-full px-3 py-1.5 text-sm border rounded-lg ${errors.displayName ? 'border-red-400 bg-red-50/30' : 'border-gray-200'}`}
            />
            {errors.displayName && (
              <p className="text-[11px] text-red-500 mt-0.5">{errors.displayName}</p>
            )}
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-0.5">
              LiteLLM 别名
              <span className="text-gray-400 ml-1">（客户端请求时使用的模型名）</span>
            </label>
            <input
              value={form.modelName}
              onChange={(e) => set('modelName', e.target.value)}
              placeholder="claude-sonnet-4-6"
              className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg font-mono text-xs"
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-0.5">描述</label>
            <input
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="模型用途说明"
              className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg"
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-0.5">协议类型</label>
            <select
              value={form.protocolType}
              onChange={(e) => set('protocolType', e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg"
            >
              <option value="openai">OpenAI Compatible</option>
              <option value="anthropic">Anthropic</option>
              <option value="google">Google</option>
            </select>
          </div>
        </div>

        {/* ── 连接配置 ── */}
        <div className="space-y-3 pt-2 border-t border-gray-100">
          <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider">连接配置</h4>

          <div>
            <label className="text-xs text-gray-500 block mb-0.5">
              Base URL <span className="text-red-500">*</span>
            </label>
            <input
              value={form.baseUrl}
              onChange={(e) => set('baseUrl', e.target.value)}
              placeholder="https://api.anthropic.com/v1"
              className={`w-full px-3 py-1.5 text-sm border rounded-lg font-mono text-xs ${errors.baseUrl ? 'border-red-400 bg-red-50/30' : 'border-gray-200'}`}
            />
            {errors.baseUrl && <p className="text-[11px] text-red-500 mt-0.5">{errors.baseUrl}</p>}
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-0.5">
              供应商模型名 <span className="text-red-500">*</span>
            </label>
            <input
              value={form.providerModelName}
              onChange={(e) => set('providerModelName', e.target.value)}
              placeholder="claude-sonnet-4-6"
              className={`w-full px-3 py-1.5 text-sm border rounded-lg font-mono text-xs ${errors.providerModelName ? 'border-red-400 bg-red-50/30' : 'border-gray-200'}`}
            />
            {errors.providerModelName && (
              <p className="text-[11px] text-red-500 mt-0.5">{errors.providerModelName}</p>
            )}
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-0.5">
              API Key
              {!model && <span className="text-red-500"> *</span>}
            </label>
            <input
              type="password"
              value={form.apiKey}
              onChange={(e) => set('apiKey', e.target.value)}
              placeholder={model ? '留空表示不更新' : 'sk-...'}
              className={`w-full px-3 py-1.5 text-sm border rounded-lg font-mono text-xs ${errors.apiKey ? 'border-red-400 bg-red-50/30' : 'border-gray-200'}`}
            />
            {errors.apiKey && <p className="text-[11px] text-red-500 mt-0.5">{errors.apiKey}</p>}
          </div>
        </div>

        {/* ── 性能配置 ── */}
        <div className="space-y-3 pt-2 border-t border-gray-100">
          <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider">性能配置</h4>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 block mb-0.5">最大 Token</label>
              <input
                type="number"
                value={form.maxTokens}
                onChange={(e) => set('maxTokens', e.target.value)}
                placeholder="32768"
                className={`w-full px-3 py-1.5 text-sm border rounded-lg ${errors.maxTokens ? 'border-red-400 bg-red-50/30' : 'border-gray-200'}`}
              />
              {errors.maxTokens && (
                <p className="text-[11px] text-red-500 mt-0.5">{errors.maxTokens}</p>
              )}
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-0.5">限流 (req/min)</label>
              <input
                type="number"
                value={form.rateLimitPerMin}
                onChange={(e) => set('rateLimitPerMin', e.target.value)}
                placeholder="60"
                className={`w-full px-3 py-1.5 text-sm border rounded-lg ${errors.rateLimitPerMin ? 'border-red-400 bg-red-50/30' : 'border-gray-200'}`}
              />
              {errors.rateLimitPerMin && (
                <p className="text-[11px] text-red-500 mt-0.5">{errors.rateLimitPerMin}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 block mb-0.5">请求超时 (秒)</label>
              <input
                type="number"
                value={form.timeout}
                onChange={(e) => set('timeout', e.target.value)}
                placeholder="600"
                className={`w-full px-3 py-1.5 text-sm border rounded-lg ${errors.timeout ? 'border-red-400 bg-red-50/30' : 'border-gray-200'}`}
              />
              {errors.timeout && (
                <p className="text-[11px] text-red-500 mt-0.5">{errors.timeout}</p>
              )}
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-0.5">流式超时 (秒)</label>
              <input
                type="number"
                value={form.streamTimeout}
                onChange={(e) => set('streamTimeout', e.target.value)}
                placeholder="45"
                className={`w-full px-3 py-1.5 text-sm border rounded-lg ${errors.streamTimeout ? 'border-red-400 bg-red-50/30' : 'border-gray-200'}`}
              />
              {errors.streamTimeout && (
                <p className="text-[11px] text-red-500 mt-0.5">{errors.streamTimeout}</p>
              )}
            </div>
          </div>
        </div>

        {/* ── 价格配置 ── */}
        <div className="space-y-3 pt-2 border-t border-gray-100">
          <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider">价格配置</h4>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-gray-500 block mb-0.5">输入价格 (/M tok)</label>
              <input
                type="number"
                step="0.01"
                value={form.inputPrice}
                onChange={(e) => set('inputPrice', e.target.value)}
                className={`w-full px-3 py-1.5 text-sm border rounded-lg ${errors.inputPrice ? 'border-red-400 bg-red-50/30' : 'border-gray-200'}`}
              />
              {errors.inputPrice && (
                <p className="text-[11px] text-red-500 mt-0.5">{errors.inputPrice}</p>
              )}
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-0.5">输出价格 (/M tok)</label>
              <input
                type="number"
                step="0.01"
                value={form.outputPrice}
                onChange={(e) => set('outputPrice', e.target.value)}
                className={`w-full px-3 py-1.5 text-sm border rounded-lg ${errors.outputPrice ? 'border-red-400 bg-red-50/30' : 'border-gray-200'}`}
              />
              {errors.outputPrice && (
                <p className="text-[11px] text-red-500 mt-0.5">{errors.outputPrice}</p>
              )}
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-0.5">货币</label>
              <select
                value={form.currency}
                onChange={(e) => set('currency', e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg"
              >
                <option value="USD">USD</option>
                <option value="CNY">CNY</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 block mb-0.5">缓存读取价格 (/M tok)</label>
              <input
                type="number"
                step="0.001"
                value={form.cacheReadCost}
                onChange={(e) => set('cacheReadCost', e.target.value)}
                placeholder="0.30"
                className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-0.5">缓存创建价格 (/M tok)</label>
              <input
                type="number"
                step="0.001"
                value={form.cacheCreationCost}
                onChange={(e) => set('cacheCreationCost', e.target.value)}
                placeholder="3.75"
                className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg"
              />
            </div>
          </div>
        </div>

        {/* ── 开关 ── */}
        <div className="flex items-center gap-4 pt-2 border-t border-gray-100">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <ToggleSwitch checked={form.isActive} onChange={(v) => set('isActive', v)} />
            启用
          </label>
        </div>

        {/* ── 授权数字员工（白名单） ── */}
        <div className="space-y-2 pt-2 border-t border-gray-100">
          <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider flex items-center gap-1">
            <Icon name="lock_person" size={12} />
            授权数字员工
          </h4>
          {model ? (
            <button
              type="button"
              onClick={() => setGrantsDrawerOpen(true)}
              className="w-full flex items-center justify-between px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              <span className="text-gray-600">
                已授权{' '}
                <span className="font-semibold text-[#007AFF]">
                  {grantCount === null ? '—' : grantCount}
                </span>{' '}
                个 Agent
              </span>
              <span className="flex items-center gap-1 text-xs text-[#007AFF]">
                点击配置
                <Icon name="chevron_right" size={14} />
              </span>
            </button>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-gray-400 bg-gray-50 rounded-lg">
              <Icon name="info" size={13} className="shrink-0" />
              保存模型后可配置授权（白名单 · 默认关闭）
            </div>
          )}
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="w-full py-2 text-sm bg-[#007AFF] text-white rounded-lg hover:bg-[#0066DD] disabled:opacity-50"
        >
          {saving ? '保存中...' : '保存'}
        </button>
      </div>

      {model && (
        <AgentGrantsDrawer
          modelId={grantsDrawerOpen ? String(model.id) : null}
          modelName={String(model.displayName || model.name || '')}
          onClose={() => setGrantsDrawerOpen(false)}
          onSaved={(count) => setGrantCount(count)}
        />
      )}
    </Drawer>
  );
}
