/**
 * App — 应用入口
 * 根据认证状态切换 LoginPage / WorkspacePage
 * 支持 Matrix SSO loginToken 回调 + DCF OIDC code/state 回调
 */
import { useEffect, useState, useCallback } from 'react';
import { useAuth } from './application/hooks/useAuth';
import { useMatrixClient } from './application/hooks/useMatrixClient';
import { useAuthStore } from './application/stores/authStore';
import { authApi } from './infrastructure/api/dcfApiClient';
import { useAgentStore } from './application/stores/agentStore';
import { initPushPolicy } from './application/services/PushPolicyService';
import { LoginPage } from './presentation/pages/LoginPage';
import { WorkspacePage } from './presentation/pages/WorkspacePage';
import { ToastContainer } from './presentation/components/ui/Toast';
import { CallOverlay } from './presentation/features/call/CallOverlay';
import { ErrorBoundary } from './presentation/components/ErrorBoundary';
import { SSOCallback } from './presentation/pages/auth/SSOCallback';

function detectSsoCallback(): 'oidc' | 'matrix' | null {
  const params = new URLSearchParams(window.location.search);
  if (params.has('code') && params.has('state')) return 'oidc';
  if (params.has('loginToken')) return 'matrix';
  return null;
}

export default function App() {
  const { isLoggedIn } = useAuth();
  const { restoreSession, ssoRedirect, loginWithToken, initiateDcfSso } = useMatrixClient();
  const loginDcfOnly = useAuthStore((s) => s.loginDcfOnly);
  const [ssoType, setSsoType] = useState<'oidc' | 'matrix' | null>(() => detectSsoCallback());
  const [restoring, setRestoring] = useState(() => detectSsoCallback() !== 'oidc');

  const loginDcf = useCallback(
    async (_hs: string, username: string, password: string) => {
      const res = await authApi.login(username, password);
      if (res.authenticated && res.user) {
        loginDcfOnly(res.user);
      } else {
        throw new Error(res.error || '登录失败');
      }
    },
    [loginDcfOnly]
  );

  useEffect(() => {
    if (ssoType === 'matrix') {
      const params = new URLSearchParams(window.location.search);
      const loginToken = params.get('loginToken')!;
      window.history.replaceState({}, '', window.location.pathname);
      const hs =
        localStorage.getItem('dcf_sso_homeserver') ||
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
          loginDcfOnly(res.user);
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

  useEffect(() => {
    if (!isLoggedIn) return;
    useAgentStore.getState().loadPersistedAgents();
    useAgentStore.getState().autoSetupFromAuth();
    const cleanupPush = initPushPolicy();
    return cleanupPush;
  }, [isLoggedIn]);

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
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          color: '#666',
        }}
      >
        正在恢复会话…
      </div>
    );
  }

  return (
    <ErrorBoundary>
      {isLoggedIn ? (
        <WorkspacePage />
      ) : (
        <LoginPage
          onLogin={loginDcf}
          onSsoLogin={(hs) => {
            localStorage.setItem('dcf_sso_homeserver', hs);
            window.location.href = ssoRedirect(hs);
          }}
          onDcfSsoLogin={() => initiateDcfSso()}
        />
      )}
      <CallOverlay />
      <ToastContainer />
    </ErrorBoundary>
  );
}
