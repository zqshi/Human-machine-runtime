import { useState } from 'react';
import { Icon } from '../../components/ui/Icon';
import { QuotaDashboardTab } from './QuotaDashboardTab';
import { QuotaAllocationTab } from './QuotaAllocationTab';
import { QuotaAlertsTab } from './QuotaAlertsTab';

type Tab = 'dashboard' | 'allocation' | 'alerts';

const TABS: { key: Tab; icon: string; label: string }[] = [
  { key: 'dashboard', icon: 'donut_large', label: '配额总览' },
  { key: 'allocation', icon: 'group', label: '资源分配' },
  { key: 'alerts', icon: 'notifications_active', label: '预警管理' },
];

export function QuotaManagementSection() {
  const [tab, setTab] = useState<Tab>('dashboard');

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">资源配额管理</h2>
          <p className="text-xs text-gray-400 mt-0.5">租户 Token 用量配额、告警阈值与分配策略</p>
        </div>
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? 'border-[#007AFF] text-[#007AFF]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon name={t.icon} size={16} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && <QuotaDashboardTab />}
      {tab === 'allocation' && <QuotaAllocationTab />}
      {tab === 'alerts' && <QuotaAlertsTab />}
    </div>
  );
}
