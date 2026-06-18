import { useState, useEffect } from 'react';
import {
  tenantApi,
  platformConfigApi,
} from '../../../application/services/adminApi';
import { Drawer } from '../../components/ui/Drawer';
import { Icon } from '../../components/ui/Icon';
import { ToggleSwitch } from '../../components/ui/ToggleSwitch';
import {
  PLAN_QUOTAS,
  DEFAULT_FEATURES,
  CAPACITY_LABELS,
  AI_LABELS,
  DATA_LABELS,
  CPU_OPTIONS,
  MEMORY_OPTIONS,
  STORAGE_OPTIONS,
  INDUSTRY_OPTIONS,
  COMPANY_SIZE_OPTIONS,
} from './tenantConstants';
import type { Quotas, Features, ConfigMeta, EditorTab } from './tenantConstants';

export function TenantEditor({
  tenant,
  onClose,
  onSaved,
  onCredentialsCreated,
}: {
  tenant: Record<string, unknown> | null;
  onClose: () => void;
  onSaved: () => void;
  onCredentialsCreated?: (credentials: { username: string; password: string }) => void;
}) {
  const isNew = !tenant;
  const [tab, setTab] = useState<EditorTab>('info');
  const [form, setForm] = useState({
    name: '',
    plan: 'standard',
    industry: '',
    companySize: '',
    contact: '',
    email: '',
    contactPhone: '',
    description: '',
  });
  const [initialAdmin, setInitialAdmin] = useState({
    username: '',
    password: '',
    autoGenerate: true,
  });
  const [quotas, setQuotas] = useState<Quotas>({ ...PLAN_QUOTAS.standard });
  const [features, setFeatures] = useState<Features>({ ...DEFAULT_FEATURES });
  const [configOverrides, setConfigOverrides] = useState<Record<string, unknown>>({});
  const [globalConfig, setGlobalConfig] = useState<Record<string, ConfigMeta>>({});
  const [overridesExpanded, setOverridesExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (isNew) {
      platformConfigApi
        .list()
        .then((res) => {
          const cfg: Record<string, ConfigMeta> = {};
          for (const [key, raw] of Object.entries(res.config || {})) {
            cfg[key] =
              typeof raw === 'object' && raw !== null
                ? (raw as ConfigMeta)
                : { value: raw, source: 'env', description: '' };
          }
          setGlobalConfig(cfg);
        })
        .catch(() => {});
    }
  }, [isNew]);

  const [prevTenantId, setPrevTenantId] = useState<string | undefined>(
    tenant ? String(tenant.id) : undefined
  );
  const currentTenantId = tenant ? String(tenant.id) : undefined;
  if (currentTenantId !== prevTenantId) {
    setPrevTenantId(currentTenantId);
    if (tenant) {
      const t = tenant;
      setForm({
        name: String(t.name || ''),
        plan: String(t.plan || 'standard'),
        industry: String(t.industry || ''),
        companySize: String(t.companySize || ''),
        contact: String(t.contactName || ''),
        email: String(t.contactEmail || ''),
        contactPhone: String(t.contactPhone || ''),
        description: String(t.description || ''),
      });
      const plan = String(t.plan || 'standard');
      const defaults = PLAN_QUOTAS[plan] || PLAN_QUOTAS.standard;
      if (t.quotas && typeof t.quotas === 'object') {
        const q = t.quotas as Record<string, unknown>;
        setQuotas({
          maxInstances: Number(q.maxInstances) || defaults.maxInstances,
          maxConcurrentInstances:
            Number(q.maxConcurrentInstances) || defaults.maxConcurrentInstances,
          maxUsers: Number(q.maxUsers) || defaults.maxUsers,
          totalCpuMillis: Number(q.totalCpuMillis) || defaults.totalCpuMillis,
          totalMemoryMB: Number(q.totalMemoryMB) || defaults.totalMemoryMB,
          totalStorageGB: Number(q.totalStorageGB) || defaults.totalStorageGB,
          instanceCpu: String(q.instanceCpu || defaults.instanceCpu),
          instanceMemory: String(q.instanceMemory || defaults.instanceMemory),
          instanceStorage: String(q.instanceStorage || defaults.instanceStorage),
          knowledgeBaseSizeMB: Number(q.knowledgeBaseSizeMB) || defaults.knowledgeBaseSizeMB,
          tokenBudgetMonthly: Number(q.tokenBudgetMonthly) || defaults.tokenBudgetMonthly,
          tokenBudgetDaily: Number(q.tokenBudgetDaily) || defaults.tokenBudgetDaily,
          apiCallsDaily: Number(q.apiCallsDaily) || defaults.apiCallsDaily,
          rateLimitPerMinute: Number(q.rateLimitPerMinute) || defaults.rateLimitPerMinute,
          dataRetentionDays: Number(q.dataRetentionDays) || defaults.dataRetentionDays,
          maxWebhooks: Number(q.maxWebhooks) || defaults.maxWebhooks,
        });
      } else {
        setQuotas({ ...defaults });
      }
      if (t.features && typeof t.features === 'object') {
        const f = t.features as Record<string, boolean>;
        setFeatures({
          aiGateway: f.aiGateway !== false,
          knowledgeBase: f.knowledgeBase !== false,
          matrixIntegration: f.matrixIntegration === true,
          customTools: f.customTools !== false,
        });
      }
    } else {
      setForm({
        name: '',
        plan: 'standard',
        industry: '',
        companySize: '',
        contact: '',
        email: '',
        contactPhone: '',
        description: '',
      });
      setQuotas({ ...PLAN_QUOTAS.standard });
      setFeatures({ ...DEFAULT_FEATURES });
      setConfigOverrides({});
      setOverridesExpanded(false);
    }
    setTab('info');
  }

  const save = async () => {
    setErrorMessage('');
    if (!form.name.trim()) {
      setErrorMessage('请输入租户名称');
      return;
    }
    if (!form.contact.trim()) {
      setErrorMessage('请输入管理员姓名');
      return;
    }
    if (!form.email.trim()) {
      setErrorMessage('请输入管理员邮箱');
      return;
    }
    if (!initialAdmin.autoGenerate) {
      if (!initialAdmin.username.trim()) {
        setErrorMessage('请输入初始管理员用户名');
        return;
      }
      if (!initialAdmin.password || initialAdmin.password.length < 6) {
        setErrorMessage('密码至少需要6个字符');
        return;
      }
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        plan: form.plan,
        industry: form.industry || undefined,
        companySize: form.companySize || undefined,
        contactName: form.contact,
        contactEmail: form.email,
        contactPhone: form.contactPhone || undefined,
        description: form.description || undefined,
        quotas,
        features,
        ...(isNew && Object.keys(configOverrides).length > 0 ? { configOverrides } : {}),
        ...(isNew && {
          initialAdmin: initialAdmin.autoGenerate
            ? undefined
            : {
                username: initialAdmin.username,
                password: initialAdmin.password,
                displayName: form.contact,
                email: form.email,
              },
        }),
      };
      if (tenant) {
        await tenantApi.update(String(tenant.id), payload);
        onSaved();
      } else {
        const result = await tenantApi.create(payload);
        if (result.adminCreated && result.initialCredentials) {
          onCredentialsCreated?.(result.initialCredentials);
        } else {
          onSaved();
        }
      }
    } catch (err) {
      console.error('保存租户失败:', err);
      setErrorMessage('保存失败，请稍后重试');
    }
    setSaving(false);
  };

  const configurableKeys = Object.entries(globalConfig).filter(([, m]) => m.source === 'config');
  const cls =
    'w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF]';

  const tabs: { key: EditorTab; label: string; icon: string }[] = [
    { key: 'info', label: '基础信息', icon: 'apartment' },
  ];

  return (
    <Drawer open onClose={onClose} title={isNew ? '新建租户' : '编辑租户'} width="w-[560px]">
      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-100 pb-2 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg transition-colors whitespace-nowrap ${
              tab === t.key ? 'bg-[#007AFF] text-white' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            <Icon name={t.icon} size={14} />
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-4 overflow-y-auto max-h-[calc(100vh-240px)] pr-1">
        {/* Tab: 基础信息 */}
        {tab === 'info' && (
          <>
            <section>
              <h4 className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                <Icon name="apartment" size={14} />
                租户信息
              </h4>
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-gray-500 block mb-0.5">名称</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className={cls}
                  />
                </div>
              </div>
            </section>
            <section>
              <h4 className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                <Icon name="business" size={14} />
                公司信息
              </h4>
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-500 block mb-0.5">行业</label>
                    <select
                      value={form.industry}
                      onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))}
                      className={cls}
                    >
                      <option value="">请选择行业</option>
                      {INDUSTRY_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-0.5">公司规模</label>
                    <select
                      value={form.companySize}
                      onChange={(e) => setForm((f) => ({ ...f, companySize: e.target.value }))}
                      className={cls}
                    >
                      <option value="">请选择规模</option>
                      {COMPANY_SIZE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-0.5">联系电话</label>
                  <input
                    type="tel"
                    value={form.contactPhone}
                    onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))}
                    placeholder="公司联系电话"
                    className={cls}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-0.5">公司描述</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="简要描述公司业务..."
                    rows={3}
                    className={`${cls} resize-none`}
                  />
                </div>
              </div>
            </section>
            <section>
              <h4 className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                <Icon name="person" size={14} />
                管理员
              </h4>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500 block mb-0.5">管理员</label>
                  <input
                    type="text"
                    value={form.contact}
                    onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))}
                    className={cls}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-0.5">邮箱</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className={cls}
                  />
                </div>
              </div>
              {/* 初始管理员账号 */}
              <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-500">初始管理员账号</span>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={initialAdmin.autoGenerate}
                      onChange={(e) => setInitialAdmin((a) => ({ ...a, autoGenerate: e.target.checked }))}
                      className="w-3.5 h-3.5 rounded border-gray-300 text-[#007AFF] focus:ring-[#007AFF]/20"
                    />
                    <span className="text-[10px] text-gray-400">自动生成密码</span>
                  </label>
                </div>
                {!initialAdmin.autoGenerate && (
                  <div className="space-y-2">
                    <div>
                      <label className="text-xs text-gray-500 block mb-0.5">用户名</label>
                      <input
                        type="text"
                        value={initialAdmin.username}
                        onChange={(e) => setInitialAdmin((a) => ({ ...a, username: e.target.value }))}
                        className={cls}
                        placeholder="设置登录用户名"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-0.5">密码</label>
                      <input
                        type="password"
                        value={initialAdmin.password}
                        onChange={(e) => setInitialAdmin((a) => ({ ...a, password: e.target.value }))}
                        className={cls}
                        placeholder="至少6个字符"
                      />
                    </div>
                  </div>
                )}
                {initialAdmin.autoGenerate && (
                  <p className="text-[10px] text-gray-400">
                    系统将自动生成用户名和密码，创建成功后将显示初始登录凭证
                  </p>
                )}
              </div>
            </section>
          </>
        )}

        {/* Tab: 容量配额 */}
        {tab === 'capacity' && (
          <section>
            <p className="text-[10px] text-gray-400 mb-3">
              容量维度 — 控制实例、用户上限和数据策略。切换套餐自动填充默认值，可手动覆盖。
            </p>
            <div className="grid grid-cols-2 gap-3">
              {(Object.keys(CAPACITY_LABELS) as (keyof typeof CAPACITY_LABELS)[]).map((k) => {
                const defaults = PLAN_QUOTAS[form.plan] || PLAN_QUOTAS.standard;
                const isDefault = quotas[k as keyof Quotas] === defaults[k as keyof Quotas];
                return (
                  <div key={k}>
                    <label className="text-xs text-gray-500 block mb-0.5">
                      {CAPACITY_LABELS[k]}
                      {isDefault && <span className="text-[10px] text-gray-300 ml-1">默认</span>}
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={quotas[k as keyof Quotas] as number}
                      onChange={(e) =>
                        setQuotas((q) => ({ ...q, [k]: Number(e.target.value) || 0 }))
                      }
                      className={`${cls} ${!isDefault ? 'border-[#007AFF]/40' : ''}`}
                    />
                  </div>
                );
              })}
              {(Object.keys(DATA_LABELS) as string[]).map((k) => {
                const defaults = PLAN_QUOTAS[form.plan] || PLAN_QUOTAS.standard;
                const isDefault = quotas[k as keyof Quotas] === defaults[k as keyof Quotas];
                return (
                  <div key={k}>
                    <label className="text-xs text-gray-500 block mb-0.5">
                      {DATA_LABELS[k]}
                      {isDefault && <span className="text-[10px] text-gray-300 ml-1">默认</span>}
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={quotas[k as keyof Quotas] as number}
                      onChange={(e) =>
                        setQuotas((q) => ({ ...q, [k]: Number(e.target.value) || 0 }))
                      }
                      className={`${cls} ${!isDefault ? 'border-[#007AFF]/40' : ''}`}
                    />
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Tab: 实例资源 */}
        {tab === 'resource' && (
          <section>
            <p className="text-[10px] text-gray-400 mb-3">
              单实例运行时资源 — K8s Pod 规格。直接用于 Pod spec 的 requests/limits。
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 block mb-0.5">CPU</label>
                <select
                  value={quotas.instanceCpu}
                  onChange={(e) => setQuotas((q) => ({ ...q, instanceCpu: e.target.value }))}
                  className={cls}
                >
                  {CPU_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-0.5">内存</label>
                <select
                  value={quotas.instanceMemory}
                  onChange={(e) => setQuotas((q) => ({ ...q, instanceMemory: e.target.value }))}
                  className={cls}
                >
                  {MEMORY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-0.5">存储</label>
                <select
                  value={quotas.instanceStorage}
                  onChange={(e) => setQuotas((q) => ({ ...q, instanceStorage: e.target.value }))}
                  className={cls}
                >
                  {STORAGE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>
        )}

        {/* Tab: AI 用量 */}
        {tab === 'ai' && (
          <section>
            <p className="text-[10px] text-gray-400 mb-3">
              AI Gateway 用量配额 — Token 预算、API 调用次数、速率限制。
            </p>
            <div className="grid grid-cols-2 gap-3">
              {(Object.keys(AI_LABELS) as string[]).map((k) => {
                const defaults = PLAN_QUOTAS[form.plan] || PLAN_QUOTAS.standard;
                const isDefault = quotas[k as keyof Quotas] === defaults[k as keyof Quotas];
                return (
                  <div key={k}>
                    <label className="text-xs text-gray-500 block mb-0.5">
                      {AI_LABELS[k]}
                      {isDefault && <span className="text-[10px] text-gray-300 ml-1">默认</span>}
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={quotas[k as keyof Quotas] as number}
                      onChange={(e) =>
                        setQuotas((q) => ({ ...q, [k]: Number(e.target.value) || 0 }))
                      }
                      className={`${cls} ${!isDefault ? 'border-[#007AFF]/40' : ''}`}
                    />
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Tab: 功能开关 */}
        {tab === 'features' && (
          <section>
            <p className="text-[10px] text-gray-400 mb-3">
              功能开关 — 控制租户可使用的平台功能模块。
            </p>
            <div className="space-y-2.5">
              {(
                [
                  { key: 'aiGateway', label: 'AI Gateway', desc: '启用 AI 网关模型路由与流控' },
                  { key: 'knowledgeBase', label: '知识库', desc: '启用文档知识库上传与检索' },
                  {
                    key: 'matrixIntegration',
                    label: 'Matrix 集成',
                    desc: '启用 Matrix 即时通讯集成',
                  },
                  { key: 'customTools', label: '自定义工具', desc: '允许租户注册自定义 MCP 工具' },
                ] as { key: keyof Features; label: string; desc: string }[]
              ).map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between py-2.5 px-3 rounded-lg border border-gray-100 bg-gray-50/50"
                >
                  <div>
                    <div className="text-sm text-gray-700 font-medium">{item.label}</div>
                    <div className="text-[10px] text-gray-400">{item.desc}</div>
                  </div>
                  <ToggleSwitch
                    checked={features[item.key]}
                    onChange={() => setFeatures((f) => ({ ...f, [item.key]: !f[item.key] }))}
                  />
                </div>
              ))}
            </div>

            {/* 初始配置覆盖 (仅新建) */}
            {isNew && configurableKeys.length > 0 && (
              <div className="mt-4">
                <button
                  onClick={() => setOverridesExpanded(!overridesExpanded)}
                  className="w-full flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-[#007AFF] transition-colors"
                >
                  <Icon name={overridesExpanded ? 'expand_less' : 'expand_more'} size={14} />
                  初始配置覆盖（可选）
                  {Object.keys(configOverrides).length > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-[#007AFF]/10 text-[#007AFF]">
                      {Object.keys(configOverrides).length} 项
                    </span>
                  )}
                </button>
                {overridesExpanded && (
                  <div className="mt-2 space-y-1.5">
                    <p className="text-[10px] text-gray-400">
                      为新租户设置初始配置覆盖，未设置的将继承全局默认值
                    </p>
                    {configurableKeys.map(([key, meta]) => {
                      const hasOverride = key in configOverrides;
                      const isBool = meta.value === true || meta.value === false;
                      const shortKey = key.split('.').slice(1).join('.');
                      return (
                        <div
                          key={key}
                          className={`flex items-center gap-2 py-1.5 px-2.5 rounded-lg border ${hasOverride ? 'border-[#007AFF]/30 bg-blue-50/30' : 'border-gray-100 bg-gray-50/50'}`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="text-xs text-gray-700">
                              {meta.description || shortKey}
                            </div>
                            <div className="text-[10px] text-gray-400">
                              默认: <span className="font-mono">{String(meta.value)}</span>
                            </div>
                          </div>
                          {isBool ? (
                            <ToggleSwitch
                              checked={
                                hasOverride
                                  ? (configOverrides[key] as boolean)
                                  : (meta.value as boolean)
                              }
                              onChange={() => {
                                const current = hasOverride ? configOverrides[key] : meta.value;
                                const next = !current;
                                if (next === meta.value) {
                                  setConfigOverrides((o) => {
                                    const n = { ...o };
                                    delete n[key];
                                    return n;
                                  });
                                } else {
                                  setConfigOverrides((o) => ({ ...o, [key]: next }));
                                }
                              }}
                            />
                          ) : (
                            <input
                              type="text"
                              value={hasOverride ? String(configOverrides[key]) : ''}
                              placeholder={String(meta.value)}
                              onChange={(e) => {
                                const v = e.target.value;
                                if (!v) {
                                  setConfigOverrides((o) => {
                                    const n = { ...o };
                                    delete n[key];
                                    return n;
                                  });
                                } else {
                                  setConfigOverrides((o) => ({
                                    ...o,
                                    [key]: /^\d+$/.test(v) ? Number(v) : v,
                                  }));
                                }
                              }}
                              className="px-2 py-0.5 text-xs border border-gray-200 rounded w-24 focus:outline-none focus:ring-1 focus:ring-[#007AFF]"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </section>
        )}
      </div>

      <div className="pt-4 mt-4 border-t border-gray-100">
        {errorMessage && (
          <div className="mb-3 px-3 py-2 text-xs text-red-600 bg-red-50 rounded-lg flex items-center gap-1">
            <Icon name="error" size={14} />
            {errorMessage}
          </div>
        )}
        <button
          onClick={save}
          disabled={saving}
          className="w-full py-2 text-sm bg-[#007AFF] text-white rounded-lg hover:bg-[#0066DD] disabled:opacity-50 transition-colors"
        >
          {saving ? '保存中...' : '保存'}
        </button>
      </div>
    </Drawer>
  );
}
