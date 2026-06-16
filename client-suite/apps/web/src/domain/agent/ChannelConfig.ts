/**
 * ChannelConfig — IM 渠道配置实体
 *
 * 对应后端 /api/admin/push-channels 的数据模型。
 * 每个配置项描述一个外部消息通道的连接参数。
 */

export type ChannelConfigType =
  | 'webhook'
  | 'dingtalk'
  | 'wecom'
  | 'wps'
  | 'email'
  | 'lark'
  | 'matrix';
export type AlertLevel = 'critical' | 'warning' | 'info';

export interface ChannelConfigProps {
  id: string;
  name: string;
  type: ChannelConfigType;
  url: string;
  secret?: string;
  enabled: boolean;
  levels: AlertLevel[];
  createdAt: string;
  updatedAt: string;
}

export const CHANNEL_TYPE_META: Record<
  ChannelConfigType,
  { label: string; icon: string; color: string }
> = {
  webhook: { label: 'Webhook', icon: 'webhook', color: '#64748b' },
  dingtalk: { label: '钉钉', icon: 'chat', color: '#3370FF' },
  wecom: { label: '企业微信', icon: 'forum', color: '#07C160' },
  wps: { label: 'WPS', icon: 'article', color: '#FF6A00' },
  email: { label: 'Email', icon: 'mail', color: '#FF9500' },
  lark: { label: '飞书', icon: 'send', color: '#3370FF' },
  matrix: { label: 'Matrix', icon: 'hub', color: '#0DBD8B' },
};
