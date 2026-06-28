import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../application/hooks/useAuth';
import { useMatrixClient } from '../../application/hooks/useMatrixClient';
import { useAuthStore } from '../../application/stores/authStore';
import { authApi } from '../../application/services/adminApi';
import { useAdminStore, type AdminSection } from '../../application/stores/adminStore';
import { EmployeesSection } from '../features/admin/EmployeesSection';
import { SkillsSection } from '../features/admin/SkillsSection';
import { ToolsSection } from '../features/admin/tools/ToolsSection';
import { SharedAgentsSection } from '../features/admin/SharedAgentsSection';
import { AIGatewaySection } from '../features/admin/AIGatewaySection';
import { AITracesSection } from '../features/admin/AITracesSection';
import { LogsSection } from '../features/admin/LogsSection';
import { AuthSection } from '../features/admin/AuthSection';
import { NotificationsSection } from '../features/admin/NotificationsSection';
import { QuotaManagementSection } from '../features/admin/QuotaManagementSection';
import {
  EvalSuites,
  EvalEvaluators,
  EvalExperiments,
  EvalExperimentDetail,
  EvalSuiteDetail,
} from '../features/admin/eval';
import { ScheduledTasksSection } from '../features/admin/scheduled-tasks/ScheduledTasksSection';
import { CockpitMonitorSection } from '../features/admin/CockpitMonitorSection';
import { CockpitStatisticsSection } from '../features/admin/CockpitStatisticsSection';
import { UserAnalysisSection } from '../features/admin/UserAnalysisSection';
import { OpsWeeklySection } from '../features/admin/OpsWeeklySection';
import { ChannelManagementSection } from '../features/admin/ChannelManagementSection';
import { AdminAssistant } from '../features/admin/AdminAssistant';
import { MemorySection } from '../features/admin/memory';
import { CredentialSection } from '../features/admin/CredentialSection';
import { FeatureFlagSection } from '../features/admin/FeatureFlagSection';
import { RuntimeTemplatesSection } from '../features/admin/RuntimeTemplatesSection';
import { ManifestSection } from '../features/admin/ManifestSection';
import { ToolApprovalsSection } from '../features/admin/ToolApprovalsSection';
import { LoginPage } from '../pages/LoginPage';
import { SSOCallback } from '../pages/auth/SSOCallback';
import { ToastContainer } from '../components/ui/Toast';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Icon } from '../components/ui/Icon';

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
    items: [
      { key: 'ai-gateway', icon: 'api', label: 'AI Gateway' },
      { key: 'ai-traces', icon: 'timeline', label: '调用追踪' },
    ],
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
    title: '资源管理',
    items: [{ key: 'quota-management', icon: 'data_usage', label: '资源配额' }],
  },
  {
    title: '渠道管理',
    items: [{ key: 'channel-admin', icon: 'radio', label: 'Channel管理' }],
  },
  {
    title: '评测中心',
    items: [
      { key: 'eval-suites', icon: 'checklist', label: '评测集' },
      { key: 'eval-evaluators', icon: 'psychology', label: '评估器' },
      { key: 'eval-experiments', icon: 'science', label: '实验中心' },
    ],
  },
  {
    title: '自动化',
    items: [{ key: 'scheduled-tasks', icon: 'schedule', label: '定时任务' }],
  },
  {
    title: '投产管控',
    items: [
      { key: 'tool-approvals', icon: 'task_alt', label: '工具审批' },
      { key: 'feature-flags', icon: 'flag', label: 'Feature Flag' },
      { key: 'runtime-templates', icon: 'memory', label: '运行时模板' },
      { key: 'runtime-manifests', icon: 'lock', label: '编译固化' },
    ],
  },
  {
    title: '系统',
    items: [
      { key: 'logs', icon: 'receipt_long', label: '日志' },
      { key: 'auth', icon: 'admin_panel_settings', label: '权限管理' },
      { key: 'notifications', icon: 'notifications', label: '通知' },
      { key: 'credentials', icon: 'key', label: '凭证管理' },
    ],
  },
];

const DATA_SECTIONS: { key: AdminSection; Component: () => JSX.Element }[] = [
  { key: 'data-overview', Component: CockpitStatisticsSection },
  { key: 'user-analysis', Component: UserAnalysisSection },
  { key: 'ops-weekly', Component: OpsWeeklySection },
  { key: 'realtime-monitor', Component: CockpitMonitorSection },
];

const DATA_SECTION_KEYS = new Set(DATA_SECTIONS.map((s) => s.key));

function SectionContent({ section }: { section: AdminSection }) {
  const [mounted, setMounted] = useState<Set<AdminSection>>(new Set());

  useEffect(() => {
    if (DATA_SECTION_KEYS.has(section) && !mounted.has(section)) {
      setMounted((prev) => new Set(prev).add(section));
    }
  }, [section, mounted]);

  const isDataSection = DATA_SECTION_KEYS.has(section);

  return (
    <>
      {DATA_SECTIONS.map(({ key, Component }) => {
        if (!mounted.has(key)) return null;
        return (
          <div key={key} style={{ display: section === key ? undefined : 'none' }}>
            <Component />
          </div>
        );
      })}
      {!isDataSection && <SwitchedSection section={section} />}
    </>
  );
}

function SwitchedSection({ section }: { section: AdminSection }) {
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
    case 'ai-traces':
      return <AITracesSection />;
    case 'logs':
      return <LogsSection />;
    case 'auth':
      return <AuthSection />;
    case 'notifications':
      return <NotificationsSection />;
    case 'quota-management':
      return <QuotaManagementSection />;
    case 'channel-admin':
      return <ChannelManagementSection />;
    case 'eval-suites':
      return <EvalSuites />;
    case 'eval-evaluators':
      return <EvalEvaluators />;
    case 'eval-experiments':
      return <EvalExperiments />;
    case 'eval-experiment-detail':
      return <EvalExperimentDetail />;
    case 'eval-suite-detail':
      return <EvalSuiteDetail />;
    case 'scheduled-tasks':
      return <ScheduledTasksSection />;
    case 'credentials':
      return <CredentialSection />;
    case 'tool-approvals':
      return <ToolApprovalsSection />;
    case 'feature-flags':
      return <FeatureFlagSection />;
    case 'runtime-templates':
      return <RuntimeTemplatesSection />;
    case 'runtime-manifests':
      return <ManifestSection />;
    default:
      return null;
  }
}

function AdminShell() {
  const currentSection = useAdminStore((s) => s.currentSection);
  const setSection = useAdminStore((s) => s.setSection);
  const { logout } = useMatrixClient();

  // 判断侧边栏高亮：eval-experiment-detail 时 eval-experiments 也高亮
  const isActive = (key: AdminSection) => {
    if (currentSection === key) return true;
    if (currentSection === 'eval-experiment-detail' && key === 'eval-experiments') return true;
    if (currentSection === 'eval-suite-detail' && key === 'eval-suites') return true;
    return false;
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-56 border-r border-gray-200 bg-white flex flex-col">
        <div className="px-5 py-4 border-b border-gray-200">
          <h1 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Icon name="shield_person" size={20} />
            管理后台
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">Admin Console</p>
        </div>
        <nav className="flex-1 px-3 py-3 overflow-y-auto">
          {NAV_GROUPS.map((group, gi) => (
            <div key={group.title}>
              {gi > 0 && <div className="mx-2 my-2 border-t border-gray-100" />}
              <div className="px-3 pt-1 pb-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                {group.title}
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <button
                    key={item.key}
                    onClick={() => setSection(item.key)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-colors ${
                      isActive(item.key)
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
        <div className="px-3 py-3 border-t border-gray-200">
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] text-red-600 hover:bg-red-50 transition-colors"
          >
            <Icon name="logout" size={18} />
            退出登录
          </button>
        </div>
      </aside>
      <main className="flex-1 min-w-0 overflow-y-auto">
        <SectionContent section={currentSection} />
      </main>
      <AdminAssistant />
    </div>
  );
}

export function AdminApp() {
  const { isLoggedIn } = useAuth();
  const { restoreSession, ssoRedirect, loginWithToken, initiateHmrSso } = useMatrixClient();
  const loginHmrOnly = useAuthStore((s) => s.loginHmrOnly);
  const [restoring, setRestoring] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return !(params.has('code') && params.has('state'));
  });
  const [ssoType, setSsoType] = useState<'oidc' | 'matrix' | null>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('code') && params.has('state')) return 'oidc';
    if (params.has('loginToken')) return 'matrix';
    return null;
  });

  const loginHmr = useCallback(
    async (_hs: string, username: string, password: string) => {
      const res = await authApi.login(username, password);
      if (res.authenticated && res.user) {
        loginHmrOnly(res.user);
      } else {
        throw new Error(res.error || '登录失败');
      }
    },
    [loginHmrOnly]
  );

  useEffect(() => {
    if (ssoType === 'matrix') {
      const params = new URLSearchParams(window.location.search);
      const loginToken = params.get('loginToken')!;
      window.history.replaceState({}, '', window.location.pathname);
      const hs =
        localStorage.getItem('hmr_sso_homeserver') ||
        `${window.location.protocol}//${window.location.hostname}:8008`;
      loginWithToken(hs, loginToken).finally(() => {
        setSsoType(null);
        setRestoring(false);
      });
      return;
    }
    if (ssoType === 'oidc') {
      return;
    }
    // Try restoring HMR session (cookie-based)
    authApi
      .me()
      .then((res) => {
        if (res.authenticated && res.user) {
          loginHmrOnly(res.user);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!useAuthStore.getState().isLoggedIn) {
          restoreSession().finally(() => setRestoring(false));
        } else {
          setRestoring(false);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅挂载时执行一次（依赖稳定，有意省略）
  }, []);

  if (ssoType === 'oidc') {
    return (
      <ErrorBoundary>
        <SSOCallback
          onSuccess={() => {
            setSsoType(null);
            setRestoring(false);
          }}
          onError={() => {
            setSsoType(null);
            setRestoring(false);
          }}
        />
      </ErrorBoundary>
    );
  }

  if (restoring) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-500">正在恢复会话…</div>
    );
  }

  return (
    <ErrorBoundary>
      {isLoggedIn ? (
        <AdminShell />
      ) : (
        <LoginPage
          variant="admin"
          onLogin={loginHmr}
          onSsoLogin={(hs) => {
            localStorage.setItem('hmr_sso_homeserver', hs);
            window.location.href = ssoRedirect(hs);
          }}
          onHmrSsoLogin={() => initiateHmrSso()}
        />
      )}
      <ToastContainer />
    </ErrorBoundary>
  );
}
