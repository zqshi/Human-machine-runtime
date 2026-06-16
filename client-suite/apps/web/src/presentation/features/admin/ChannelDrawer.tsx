import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { channelApi } from '../../../application/services/adminApi';
import { useToastStore } from '../../../application/stores/toastStore';
import { Icon } from '../../components/ui/Icon';
import type { Channel } from './ChannelManagementSection';

interface ChannelDrawerProps {
  open: boolean;
  channel: Channel | null;
  onClose: () => void;
  onSave: () => void;
}

export function ChannelDrawer({ open, channel, onClose, onSave }: ChannelDrawerProps) {
  const [formData, setFormData] = useState({
    appId: '',
    name: '',
    ak: '',
    sk: '',
    webhookUrl: '',
    webhookEnabled: false,
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  useEffect(() => {
    if (channel) {
      setFormData({
        appId: channel.appId,
        name: channel.name,
        ak: channel.ak,
        sk: channel.sk,
        webhookUrl: channel.webhookUrl,
        webhookEnabled: channel.webhookEnabled,
      });
      setErrors({});
    } else {
      setFormData({
        appId: '',
        name: '',
        ak: '',
        sk: '',
        webhookUrl: '',
        webhookEnabled: false,
      });
      setErrors({});
    }
  }, [channel, open]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.appId.trim()) {
      newErrors.appId = '请输入应用ID';
    }
    if (!formData.name.trim()) {
      newErrors.name = '请输入应用名称';
    }
    if (!formData.ak.trim()) {
      newErrors.ak = '请输入AK';
    }
    if (!formData.sk.trim()) {
      newErrors.sk = '请输入SK';
    }
    if (formData.webhookEnabled && !formData.webhookUrl.trim()) {
      newErrors.webhookUrl = '请输入Webhook地址';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setSaving(true);
    try {
      if (channel) {
        await channelApi.update(channel.id, formData);
      } else {
        await channelApi.create(formData);
      }
      onSave();
    } catch {
      setErrors({ submit: '保存失败，请重试' });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const subscriptionUrl = useMemo(() => {
    if (!formData.appId.trim() || !formData.name.trim() || !formData.ak.trim() || !formData.sk.trim()) {
      return '';
    }
    const origin = window.location.origin;
    const params = new URLSearchParams({
      appId: formData.appId.trim(),
      name: formData.name.trim(),
      ak: formData.ak.trim(),
      sk: formData.sk.trim(),
    });
    return `${origin}/api/channels/subscribe?${params.toString()}`;
  }, [formData.appId, formData.name, formData.ak, formData.sk]);

  const handleCopyUrl = async () => {
    if (!subscriptionUrl) return;
    try {
      await navigator.clipboard.writeText(subscriptionUrl);
      useToastStore.getState().addToast('订阅地址已复制到剪贴板', 'success');
    } catch {
      useToastStore.getState().addToast('复制失败，请手动选择复制', 'error');
    }
  };

  if (!open) return null;

  return createPortal(
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 w-[420px] bg-white border-l border-gray-200 shadow-xl z-50 flex flex-col">
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-6 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">
              {channel ? '编辑应用配置' : '新增应用配置'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <Icon name="close" size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">应用ID *</label>
              <input
                type="text"
                value={formData.appId}
                onChange={(e) => handleChange('appId', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg text-sm ${
                  errors.appId
                    ? 'border-red-300 bg-red-50'
                    : 'border-gray-200 focus:border-[#007AFF]'
                }`}
                placeholder="请输入应用ID"
              />
              {errors.appId && <p className="mt-1 text-xs text-red-500">{errors.appId}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">应用名称 *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg text-sm ${
                  errors.name
                    ? 'border-red-300 bg-red-50'
                    : 'border-gray-200 focus:border-[#007AFF]'
                }`}
                placeholder="请输入应用名称"
              />
              {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Access Key (AK) *
              </label>
              <input
                type="text"
                value={formData.ak}
                onChange={(e) => handleChange('ak', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg text-sm font-mono ${
                  errors.ak ? 'border-red-300 bg-red-50' : 'border-gray-200 focus:border-[#007AFF]'
                }`}
                placeholder="请输入AK"
              />
              {errors.ak && <p className="mt-1 text-xs text-red-500">{errors.ak}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Secret Key (SK) *
              </label>
              <input
                type="password"
                value={formData.sk}
                onChange={(e) => handleChange('sk', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg text-sm font-mono ${
                  errors.sk ? 'border-red-300 bg-red-50' : 'border-gray-200 focus:border-[#007AFF]'
                }`}
                placeholder="请输入SK"
              />
              {errors.sk && <p className="mt-1 text-xs text-red-500">{errors.sk}</p>}
            </div>

            <div className="border-t border-gray-100 pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                配置订阅接口 URL
              </label>
              {subscriptionUrl ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={subscriptionUrl}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-xs font-mono bg-gray-50 text-gray-600 truncate"
                    title={subscriptionUrl}
                  />
                  <button
                    type="button"
                    onClick={handleCopyUrl}
                    className="shrink-0 px-2.5 py-2 text-xs text-[#007AFF] border border-[#007AFF]/30 rounded-lg hover:bg-[#007AFF]/5 transition-colors flex items-center gap-1"
                    title="复制订阅地址"
                  >
                    <Icon name="content_copy" size={14} />
                    复制
                  </button>
                </div>
              ) : (
                <p className="text-xs text-gray-400">请先填写应用ID、名称、AK、SK 后自动生成</p>
              )}
              <p className="mt-1 text-xs text-gray-400">
                用于回填至开放平台事件订阅 HTTP 接口地址
              </p>
            </div>

            <div className="border-t border-gray-100 pt-4">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium text-gray-700">启用 Webhook</label>
                <button
                  onClick={() => handleChange('webhookEnabled', !formData.webhookEnabled)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    formData.webhookEnabled ? 'bg-[#007AFF]' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      formData.webhookEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {formData.webhookEnabled && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Webhook 地址
                </label>
                <input
                  type="text"
                  value={formData.webhookUrl}
                  onChange={(e) => handleChange('webhookUrl', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg text-sm ${
                    errors.webhookUrl
                      ? 'border-red-300 bg-red-50'
                      : 'border-gray-200 focus:border-[#007AFF]'
                  }`}
                  placeholder="https://example.com/webhook"
                />
                {errors.webhookUrl && (
                  <p className="mt-1 text-xs text-red-500">{errors.webhookUrl}</p>
                )}
                <p className="mt-1 text-xs text-gray-400">接收渠道平台事件通知的地址</p>
              </div>
            )}

            {errors.submit && <p className="text-xs text-red-500">{errors.submit}</p>}
          </div>

          <div className="flex items-center gap-3 p-6 border-t border-gray-100 bg-gray-50/50">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex-1 px-4 py-2 bg-[#007AFF] text-white rounded-lg text-sm font-medium hover:bg-[#0066CC] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <Icon name="refresh" size={16} className="animate-spin" />
                  保存中...
                </span>
              ) : (
                '保存'
              )}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
