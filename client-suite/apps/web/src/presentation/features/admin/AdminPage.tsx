import { useAdminStore, type AdminSection } from '../../../application/stores/adminStore';
import { Icon } from '../../components/ui/Icon';
import { EmployeesSection } from './EmployeesSection';
import { SkillsSection } from './SkillsSection';
import { ToolsSection } from './tools/ToolsSection';
import { SharedAgentsSection } from './SharedAgentsSection';
import { AIGatewaySection } from './AIGatewaySection';
import { LogsSection } from './LogsSection';
import { AuthSection } from './AuthSection';
import { NotificationsSection } from './NotificationsSection';
import { OpenClawMonitorSection } from './OpenClawMonitorSection';
import { OpenClawStatisticsSection } from './OpenClawStatisticsSection';
import { UserAnalysisSection } from './UserAnalysisSection';
import { OpsWeeklySection } from './OpsWeeklySection';
import { QuotaManagementSection } from './QuotaManagementSection';
import { MemorySection } from './memory';
import { ToolApprovalsSection } from './ToolApprovalsSection';
import { FeatureFlagSection } from './FeatureFlagSection';
import { RuntimeTemplatesSection } from './RuntimeTemplatesSection';

type NavItem = { key: AdminSection; icon: string; label: string };
type NavGroup = { title: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Agent 管理',
    items: [
      { key: 'employees', icon: 'badge', label: '数字员工' },
      { key: 'skills', icon: 'bolt', label: '技能管理' },
      { key: 'tools', icon: 'build', label: '工具管理' },
      { key: 'shared-agents', icon: 'smart_toy', label: '共享 Agent' },
      { key: 'employee-memory', icon: 'psychology', label: '记忆库' },
    ],
  },
  {
    title: 'AI 服务',
    items: [{ key: 'ai-gateway', icon: 'api', label: 'AI Gateway' }],
  },
  {
    title: '资源管控',
    items: [{ key: 'quota-management', icon: 'donut_large', label: '资源配额' }],
  },
  {
    title: '数据统计',
    items: [
      { key: 'data-overview', icon: 'dashboard', label: '数据概览' },
      { key: 'user-analysis', icon: 'person_search', label: '用户分析' },
      { key: 'ops-weekly', icon: 'summarize', label: '运营周报' },
      { key: 'realtime-monitor', icon: 'monitor_heart', label: '实时监控' },
    ],
  },
  {
    title: '系统',
    items: [
      { key: 'logs', icon: 'receipt_long', label: '日志' },
      { key: 'auth', icon: 'admin_panel_settings', label: '权限管理' },
      { key: 'notifications', icon: 'notifications', label: '通知' },
    ],
  },
  {
    title: '投产管控',
    items: [
      { key: 'tool-approvals', icon: 'task_alt', label: '工具审批' },
      { key: 'feature-flags', icon: 'flag', label: 'Feature Flag' },
      { key: 'runtime-templates', icon: 'memory', label: '运行时模板' },
    ],
  },
];

function SectionContent({ section }: { section: AdminSection }) {
  switch (section) {
    case 'employees':
      return <EmployeesSection />;
    case 'skills':
      return <SkillsSection />;
    case 'tools':
      return <ToolsSection />;
    case 'shared-agents':
      return <SharedAgentsSection />;
    case 'employee-memory':
      return <MemorySection />;
    case 'ai-gateway':
      return <AIGatewaySection />;
    case 'quota-management':
      return <QuotaManagementSection />;
    case 'data-overview':
      return <OpenClawStatisticsSection />;
    case 'user-analysis':
      return <UserAnalysisSection />;
    case 'ops-weekly':
      return <OpsWeeklySection />;
    case 'realtime-monitor':
      return <OpenClawMonitorSection />;
    case 'logs':
      return <LogsSection />;
    case 'auth':
      return <AuthSection />;
    case 'notifications':
      return <NotificationsSection />;
    case 'tool-approvals':
      return <ToolApprovalsSection />;
    case 'feature-flags':
      return <FeatureFlagSection />;
    case 'runtime-templates':
      return <RuntimeTemplatesSection />;
  }
}

export function AdminPage() {
  const currentSection = useAdminStore((s) => s.currentSection);
  const setSection = useAdminStore((s) => s.setSection);

  return (
    <div className="flex h-full">
      <aside className="w-52 border-r border-gray-200 bg-gray-50/80 backdrop-blur-sm flex flex-col py-3 overflow-y-auto shrink-0">
        <div className="px-4 pb-3 mb-2 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-700">管理控制面板</h2>
        </div>
        <nav className="flex-1 px-2">
          {NAV_GROUPS.map((group, gi) => (
            <div key={group.title}>
              {gi > 0 && <div className="mx-3 my-2 border-t border-gray-200" />}
              <div className="px-3 pt-1 pb-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                {group.title}
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <button
                    key={item.key}
                    onClick={() => setSection(item.key)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-colors ${
                      currentSection === item.key
                        ? 'bg-[#007AFF]/10 text-[#007AFF] font-medium'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Icon name={item.icon} size={18} />
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>
      <main className="flex-1 min-w-0 overflow-y-auto">
        <SectionContent section={currentSection} />
      </main>
    </div>
  );
}
