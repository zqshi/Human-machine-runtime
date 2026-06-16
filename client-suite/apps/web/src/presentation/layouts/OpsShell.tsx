import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../application/hooks/useAuth';
import { useMatrixClient } from '../../application/hooks/useMatrixClient';
import { useAuthStore } from '../../application/stores/authStore';
import { authApi } from '../../application/services/adminApi';
import { useAdminStore, type PlatformSection } from '../../application/stores/adminStore';
import { TenantsSection } from '../features/platform/TenantsSection';
import { PlansSection } from '../features/platform/PlansSection';
import { PlatformUsersSection } from '../features/platform/PlatformUsersSection';
import { PlatformConfigSection } from '../features/platform/PlatformConfigSection';
import { PlatformMonitoringSection } from '../features/platform/PlatformMonitoringSection';
import { PlatformAuditSection } from '../features/platform/PlatformAuditSection';
import { PlatformRolesSection } from '../features/platform/PlatformRolesSection';
import { LoginPage } from '../pages/LoginPage';
import { SSOCallback } from '../pages/auth/SSOCallback';
import { ToastContainer } from '../components/ui/Toast';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Icon } from '../components/ui/Icon';

type NavItem = { key: PlatformSection; icon: string; label: string };
type NavGroup = { title: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    title: '租户管理',
    items: [
      { key: 'tenants', icon: 'apartment', label: '租户管理' },
      { key: 'plans', icon: 'loyalty', label: '套餐管理' },
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
  {
    title: '权限管理',
    items: [
      { key: 'users', icon: 'group', label: '平台用户' },
      { key: 'roles', icon: 'shield', label: '角色管理' },
    ],
  },
];

function SectionContent({ section }: { section: PlatformSection }) {
  switch (section) {
    case 'tenants':
      return <TenantsSection />;
    case 'plans':
      return <PlansSection />;
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

function OpsShell() {
  const currentSection = useAdminStore((s) => s.platformSection);
  const setSection = useAdminStore((s) => s.setPlatformSection);
  const { logout } = useMatrixClient();

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-56 border-r border-gray-200 bg-white flex flex-col">
        <div className="px-5 py-4 border-b border-gray-200">
          <h1 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Icon name="domain" size={20} />
            运营管理平台
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">租户运营与平台监控</p>
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
    </div>
  );
}

export function OpsApp() {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        <OpsShell />
      ) : (
        <LoginPage
          variant="ops"
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
