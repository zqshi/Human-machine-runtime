import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuthStore, type ChannelMode } from '../../../application/stores/authStore';
import { useMatrixClient } from '../../../application/hooks/useMatrixClient';
import { Icon } from '../../components/ui/Icon';
import { useUIStore } from '../../../application/stores/uiStore';
import { useChannelConfigStore } from '../../../application/stores/channelConfigStore';
import {
  CHANNEL_TYPE_META,
  type ChannelConfigType,
  type AlertLevel,
  type ChannelConfigProps,
} from '../../../domain/agent/ChannelConfig';

type SettingsSection =
  | 'profile'
  | 'server'
  | 'channel-mode'
  | 'channels'
  | 'notifications'
  | 'about';

const SECTIONS: { key: SettingsSection; label: string; icon: string }[] = [
  { key: 'profile', label: '个人信息', icon: 'person' },
  { key: 'server', label: '服务器', icon: 'dns' },
  { key: 'channel-mode', label: '消息通道', icon: 'swap_horiz' },
  { key: 'channels', label: '渠道', icon: 'settings_input_component' },
  { key: 'notifications', label: '通知偏好', icon: 'notifications' },
  { key: 'about', label: '关于', icon: 'info' },
];

export function SettingsSidebar() {
  const rawSubView = useUIStore((s) => s.subView);
  const settingsSection = rawSubView?.startsWith('settings:')
    ? (rawSubView.slice(9) as SettingsSection)
    : (rawSubView as SettingsSection | null);
  const active =
    settingsSection && SECTIONS.some((s) => s.key === settingsSection)
      ? settingsSection
      : 'profile';

  return (
    <div className="p-4 flex flex-col gap-4">
      <h3 className="text-lg font-semibold text-text-primary">设置</h3>
      <div className="space-y-0.5">
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => useUIStore.getState().setSubView(`settings:${s.key}`)}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors ${
              active === s.key
                ? 'bg-primary/10 text-primary font-semibold'
                : 'hover:bg-bg-hover text-text-primary font-medium'
            }`}
          >
            <Icon
              name={s.icon}
              size={16}
              className={active === s.key ? 'text-primary' : 'text-text-secondary'}
            />
            <span>{s.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const homeserverUrl = useAuthStore((s) => s.homeserverUrl);
  const { logout } = useMatrixClient();
  const [notifSound, setNotifSound] = useState(true);
  const [notifPreview, setNotifPreview] = useState(true);
  const [notifDesktop, setNotifDesktop] = useState(false);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const subView = useUIStore((s) => s.subView);

  const sectionKey = subView?.startsWith('settings:') ? subView.slice(9) : subView;
  const activeSection =
    sectionKey && SECTIONS.some((s) => s.key === sectionKey) ? sectionKey : null;
  useEffect(() => {
    if (activeSection) {
      sectionRefs.current[activeSection]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [activeSection]);

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="w-full max-w-3xl mx-auto space-y-8">
        <h2 className="text-lg font-semibold text-text-primary">设置</h2>
        {/* Profile */}
        <section
          ref={(el) => {
            sectionRefs.current['profile'] = el;
          }}
          className="space-y-4"
        >
          <h2 className="text-base font-semibold text-text-primary">个人信息</h2>
          <div className="flex items-center gap-4 p-4 bg-bg-white-var rounded-xl border border-border">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-white text-xl font-bold shrink-0">
              {user?.displayName?.charAt(0)?.toUpperCase() ?? '?'}
            </div>
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-semibold text-text-primary truncate">
                {user?.displayName ?? '—'}
              </p>
              <p className="text-xs text-text-muted truncate">{user?.userId ?? '—'}</p>
              {(user?.org || user?.department) && (
                <p className="text-xs text-text-secondary truncate">
                  {[user.org, user.department].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Server */}
        <section
          ref={(el) => {
            sectionRefs.current['server'] = el;
          }}
          className="space-y-4"
        >
          <h2 className="text-base font-semibold text-text-primary">服务器信息</h2>
          <div className="p-4 bg-bg-white-var rounded-xl border border-border space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-muted">Homeserver</span>
              <span className="text-xs text-text-primary font-mono">{homeserverUrl ?? '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-muted">连接状态</span>
              <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                已连接
              </span>
            </div>
          </div>
        </section>

        {/* Channels */}
        <section
          ref={(el) => {
            sectionRefs.current['channel-mode'] = el;
          }}
          className="space-y-4"
        >
          <ChannelModeSelector />
        </section>

        {/* Alert Channels */}
        <section
          ref={(el) => {
            sectionRefs.current['channels'] = el;
          }}
          className="space-y-4"
        >
          <ChannelSettings />
        </section>

        {/* Notification Preferences */}
        <section
          ref={(el) => {
            sectionRefs.current['notifications'] = el;
          }}
          className="space-y-4"
        >
          <h2 className="text-base font-semibold text-text-primary">通知偏好</h2>
          <div className="p-4 bg-bg-white-var rounded-xl border border-border space-y-4">
            <ToggleRow label="消息提示音" checked={notifSound} onChange={setNotifSound} />
            <ToggleRow label="消息预览" checked={notifPreview} onChange={setNotifPreview} />
            <ToggleRow label="桌面通知" checked={notifDesktop} onChange={setNotifDesktop} />
          </div>
        </section>

        {/* About */}
        <section
          ref={(el) => {
            sectionRefs.current['about'] = el;
          }}
          className="space-y-4"
        >
          <h2 className="text-base font-semibold text-text-primary">关于</h2>
          <div className="p-4 bg-bg-white-var rounded-xl border border-border space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-muted">版本</span>
              <span className="text-xs text-text-primary">0.1.0</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-muted">内核</span>
              <span className="text-xs text-text-primary">Matrix Synapse</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-muted">前端框架</span>
              <span className="text-xs text-text-primary">React 18 + Vite 5</span>
            </div>
          </div>
        </section>

        {/* Logout */}
        <section>
          <button
            onClick={logout}
            className="w-full py-2.5 rounded-xl text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors"
          >
            退出登录
          </button>
        </section>
      </div>
    </div>
  );
}

/* ─── ChannelSettings ─── */

const ALL_TYPES: ChannelConfigType[] = [
  'lark',
  'dingtalk',
  'wecom',
  'wps',
  'email',
  'webhook',
  'matrix',
];
const ALL_LEVELS: AlertLevel[] = ['critical', 'warning', 'info'];
const LEVEL_LABELS: Record<AlertLevel, string> = {
  critical: '严重',
  warning: '警告',
  info: '信息',
};

interface ChannelFormState {
  id?: string;
  name: string;
  type: ChannelConfigType;
  url: string;
  secret: string;
  enabled: boolean;
  levels: AlertLevel[];
}

const EMPTY_FORM: ChannelFormState = {
  name: '',
  type: 'webhook',
  url: '',
  secret: '',
  enabled: true,
  levels: ['critical', 'warning'],
};

function ChannelSettings() {
  const {
    channels,
    loading,
    testResults,
    fetchChannels,
    addChannel,
    updateChannel,
    deleteChannel,
    testChannel,
  } = useChannelConfigStore();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ChannelFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  const handleEdit = (ch: ChannelConfigProps) => {
    setForm({
      id: ch.id,
      name: ch.name,
      type: ch.type as ChannelConfigType,
      url: ch.url,
      secret: ch.secret || '',
      enabled: ch.enabled,
      levels: ch.levels as AlertLevel[],
    });
    setShowForm(true);
  };

  const handleAdd = () => {
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const handleSave = useCallback(async () => {
    if (!form.name.trim() || !form.url.trim() || saving) return;
    setSaving(true);
    try {
      if (form.id) {
        await updateChannel({
          ...form,
          id: form.id,
          createdAt: '',
          updatedAt: '',
        } as ChannelConfigProps);
      } else {
        await addChannel({
          name: form.name,
          type: form.type,
          url: form.url,
          secret: form.secret,
          enabled: form.enabled,
          levels: form.levels,
        });
      }
      setShowForm(false);
      setForm(EMPTY_FORM);
    } finally {
      setSaving(false);
    }
  }, [form, saving, addChannel, updateChannel]);

  const toggleLevel = (level: AlertLevel) => {
    setForm((f) => ({
      ...f,
      levels: f.levels.includes(level) ? f.levels.filter((l) => l !== level) : [...f.levels, level],
    }));
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-text-primary">渠道</h2>
        <button
          type="button"
          onClick={handleAdd}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/10 text-xs text-primary font-medium hover:bg-primary/20 transition-colors"
        >
          <Icon name="add" size={14} />
          添加
        </button>
      </div>

      {loading && channels.length === 0 && (
        <div className="p-4 bg-bg-white-var rounded-xl border border-border text-center">
          <p className="text-xs text-text-muted py-4">加载中...</p>
        </div>
      )}

      {!loading && channels.length === 0 && !showForm && (
        <div className="p-6 bg-bg-white-var rounded-xl border border-border text-center space-y-3">
          <Icon name="settings_input_component" size={32} className="text-text-muted/30 mx-auto" />
          <p className="text-sm text-text-muted">暂未配置渠道</p>
          <p className="text-xs text-text-muted/70">添加飞书、钉钉、企微等渠道，接收消息推送</p>
          <button
            type="button"
            onClick={handleAdd}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors"
          >
            <Icon name="add" size={14} />
            添加渠道
          </button>
        </div>
      )}

      {/* Channel list */}
      {channels.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {channels.map((ch) => {
            const meta =
              CHANNEL_TYPE_META[ch.type as ChannelConfigType] ?? CHANNEL_TYPE_META.webhook;
            const testStatus = testResults[ch.id];
            return (
              <div key={ch.id} className="p-3.5 bg-bg-white-var rounded-xl border border-border">
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${meta.color}14` }}
                  >
                    <Icon name={meta.icon} size={16} style={{ color: meta.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-text-primary truncate">
                        {ch.name}
                      </span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-fill-tertiary text-text-muted">
                        {meta.label}
                      </span>
                    </div>
                    <p className="text-[10px] text-text-muted truncate mt-0.5">{ch.url}</p>
                  </div>
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${ch.enabled ? 'bg-green-500' : 'bg-slate-400'}`}
                    title={ch.enabled ? '已启用' : '已禁用'}
                  />
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => testChannel(ch.id)}
                      disabled={testStatus === 'testing'}
                      className={`h-6 px-2 rounded text-[10px] transition-colors ${
                        testStatus === 'success'
                          ? 'bg-green-50 text-green-600'
                          : testStatus === 'fail'
                            ? 'bg-red-50 text-red-600'
                            : testStatus === 'testing'
                              ? 'bg-yellow-50 text-yellow-600'
                              : 'bg-fill-tertiary text-text-muted hover:text-text-primary'
                      }`}
                    >
                      {testStatus === 'testing'
                        ? '测试中'
                        : testStatus === 'success'
                          ? '连通'
                          : testStatus === 'fail'
                            ? '失败'
                            : '测试'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEdit(ch)}
                      className="w-6 h-6 rounded flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-bg-hover"
                    >
                      <Icon name="edit" size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteChannel(ch.id)}
                      className="w-6 h-6 rounded flex items-center justify-center text-text-muted hover:text-red-500 hover:bg-red-50"
                    >
                      <Icon name="delete" size={13} />
                    </button>
                  </div>
                </div>
                <div className="flex gap-1.5 mt-2">
                  {(ch.levels as AlertLevel[]).map((l) => (
                    <span
                      key={l}
                      className={`text-[9px] px-1.5 py-0.5 rounded ${
                        l === 'critical'
                          ? 'bg-red-50 text-red-600'
                          : l === 'warning'
                            ? 'bg-yellow-50 text-yellow-600'
                            : 'bg-blue-50 text-blue-600'
                      }`}
                    >
                      {LEVEL_LABELS[l]}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit form */}
      {showForm && (
        <div className="p-4 bg-bg-white-var rounded-xl border-2 border-primary/20 space-y-3">
          <p className="text-xs text-primary font-semibold">{form.id ? '编辑渠道' : '添加渠道'}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] text-text-muted block mb-1">名称</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="渠道名称"
                className="w-full h-8 rounded-lg border border-border bg-bg-white-var px-3 text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="text-[10px] text-text-muted block mb-1">类型</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as ChannelConfigType })}
                className="w-full h-8 rounded-lg border border-border bg-bg-white-var px-3 text-xs text-text-primary focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
              >
                {ALL_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {CHANNEL_TYPE_META[t].label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-text-muted block mb-1">密钥（可选）</label>
              <input
                value={form.secret}
                onChange={(e) => setForm({ ...form, secret: e.target.value })}
                placeholder="签名密钥"
                className="w-full h-8 rounded-lg border border-border bg-bg-white-var px-3 text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] text-text-muted block mb-1">推送地址 (URL)</label>
            <input
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              placeholder="https://hooks.example.com/..."
              className="w-full h-8 rounded-lg border border-border bg-bg-white-var px-3 text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
            />
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <div>
              <label className="text-[10px] text-text-muted block mb-1">接收级别</label>
              <div className="flex gap-3">
                {ALL_LEVELS.map((l) => (
                  <label
                    key={l}
                    className="flex items-center gap-1 text-[10px] text-text-secondary cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={form.levels.includes(l)}
                      onChange={() => toggleLevel(l)}
                      className="w-3 h-3 rounded accent-primary"
                    />
                    {LEVEL_LABELS[l]}
                  </label>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-1.5 text-[10px] text-text-secondary cursor-pointer mt-4">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                className="w-3.5 h-3.5 rounded accent-primary"
              />
              启用
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="h-7 px-3 rounded-lg border border-border text-[10px] text-text-secondary hover:bg-bg-hover transition-colors"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!form.name.trim() || !form.url.trim() || saving}
              className="h-7 px-4 rounded-lg bg-primary text-[10px] text-white font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-text-primary">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`w-9 h-5 rounded-full transition-colors relative ${checked ? 'bg-primary' : 'bg-slate-300'}`}
      >
        <span
          className={`absolute top-0.5 w-4 h-4 rounded-full bg-bg-white-var transition-transform shadow-sm ${checked ? 'left-[18px]' : 'left-0.5'}`}
        />
      </button>
    </div>
  );
}

/* ─── ChannelModeSelector ─── */

const CHANNEL_MODE_OPTIONS: { value: ChannelMode; label: string; description: string }[] = [
  { value: 'matrix', label: 'Matrix', description: '连接 Matrix Synapse 服务器' },
  { value: 'wps', label: 'WPS', description: '连接 WPS IM 通道' },
];

const WPS_BASE_URL_KEY = 'hmr_wps_base_url';
const DEFAULT_WPS_BASE_URL = import.meta.env.VITE_WPS_BASE_URL || 'http://localhost:3080';

function ChannelModeSelector() {
  const channelMode = useAuthStore((s) => s.channelMode);
  const setChannelMode = useAuthStore((s) => s.setChannelMode);
  // D11 守卫:WPS IM 通道未显式启用(VITE_WPS_IM_ENABLED=true)时不暴露 WPS 选项,
  // 防用户误切到 7 个方法未实现的通道。
  const wpsImEnabled = import.meta.env.VITE_WPS_IM_ENABLED === 'true';
  const channelOptions = CHANNEL_MODE_OPTIONS.filter((o) => o.value !== 'wps' || wpsImEnabled);
  const [wpsBaseUrl, setWpsBaseUrl] = useState(() => {
    try {
      return localStorage.getItem(WPS_BASE_URL_KEY) || DEFAULT_WPS_BASE_URL;
    } catch {
      return DEFAULT_WPS_BASE_URL;
    }
  });
  const [urlDirty, setUrlDirty] = useState(false);

  const handleModeChange = (mode: ChannelMode) => {
    setChannelMode(mode);
  };

  const handleSaveWpsUrl = () => {
    const trimmed = wpsBaseUrl.trim();
    if (!trimmed) return;
    try {
      localStorage.setItem(WPS_BASE_URL_KEY, trimmed);
    } catch {
      /* ignore quota errors */
    }
    setUrlDirty(false);
  };

  return (
    <>
      <h2 className="text-base font-semibold text-text-primary">消息通道</h2>
      <div className="p-4 bg-bg-white-var rounded-xl border border-border space-y-4">
        <div className="space-y-2">
          {channelOptions.map((opt) => (
            <label
              key={opt.value}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                channelMode === opt.value
                  ? 'border-primary/40 bg-primary/5'
                  : 'border-transparent hover:bg-bg-hover'
              }`}
            >
              <input
                type="radio"
                name="channelMode"
                value={opt.value}
                checked={channelMode === opt.value}
                onChange={() => handleModeChange(opt.value)}
                className="mt-0.5 accent-primary"
              />
              <div className="min-w-0">
                <p className="text-xs font-medium text-text-primary">{opt.label}</p>
                <p className="text-[10px] text-text-muted mt-0.5">{opt.description}</p>
              </div>
            </label>
          ))}
        </div>

        {/* WPS base URL config */}
        {channelMode === 'wps' && wpsImEnabled && (
          <div className="pt-2 border-t border-border space-y-2">
            <label className="text-[10px] text-text-muted block">WPS IM 服务地址</label>
            <div className="flex gap-2">
              <input
                value={wpsBaseUrl}
                onChange={(e) => {
                  setWpsBaseUrl(e.target.value);
                  setUrlDirty(true);
                }}
                placeholder="http://localhost:3080"
                className="flex-1 h-8 rounded-lg border border-border bg-bg-white-var px-3 text-xs text-text-primary placeholder-text-muted font-mono focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
              />
              <button
                type="button"
                onClick={handleSaveWpsUrl}
                disabled={!urlDirty || !wpsBaseUrl.trim()}
                className="h-8 px-3 rounded-lg bg-primary text-[10px] text-white font-medium hover:bg-primary/90 disabled:opacity-40 transition-colors"
              >
                保存
              </button>
            </div>
            <p className="text-[10px] text-text-muted/70">
              默认使用环境变量 VITE_WPS_BASE_URL，未配置时回退到 localhost:3080
            </p>
          </div>
        )}
      </div>
    </>
  );
}
