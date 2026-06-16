import { useAdminStore, type PlatformSection } from '../../../application/stores/adminStore';
import { Icon } from '../../components/ui/Icon';
import { TenantsSection } from './TenantsSection';
import { PlatformUsersSection } from './PlatformUsersSection';
import { PlatformRolesSection } from './PlatformRolesSection';
import { PlatformConfigSection } from './PlatformConfigSection';
import { PlatformMonitoringSection } from './PlatformMonitoringSection';
import { PlatformAuditSection } from './PlatformAuditSection';

type NavItem = { key: PlatformSection; icon: string; label: string };
type NavGroup = { title: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    title: '租户与用户',
    items: [
      { key: 'tenants', icon: 'apartment', label: '租户管理' },
      { key: 'users', icon: 'group', label: '平台用户' },
      { key: 'roles', icon: 'shield', label: '角色管理' },
    ],
  },
  {
    title: '平台运维',
    items: [
      { key: 'config', icon: 'tune', label: '平台配置' },
      { key: 'monitoring', icon: 'monitoring', label: '平台监控' },
      { key: 'audit', icon: 'receipt_long', label: '审计日志' },
    ],
  },
];

function SectionContent({ section }: { section: PlatformSection }) {
  switch (section) {
    case 'tenants':
      return <TenantsSection />;
    case 'users':
      return <PlatformUsersSection />;
    case 'roles':
      return <PlatformRolesSection />;
    case 'config':
      return <PlatformConfigSection />;
    case 'monitoring':
      return <PlatformMonitoringSection />;
    case 'audit':
      return <PlatformAuditSection />;
  }
}

export function PlatformPage() {
  const currentSection = useAdminStore((s) => s.platformSection);
  const setSection = useAdminStore((s) => s.setPlatformSection);

  return (
    <div className="flex h-full">
      <aside className="w-52 border-r border-gray-200 bg-gray-50/80 backdrop-blur-sm flex flex-col py-3 overflow-y-auto shrink-0">
        <div className="px-4 pb-3 mb-2 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-700">运营管理平台</h2>
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
      <div className="flex-1 min-w-0 overflow-y-auto">
        <SectionContent section={currentSection} />
      </div>
    </div>
  );
}
