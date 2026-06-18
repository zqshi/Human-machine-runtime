import { useEffect, useState, useMemo } from 'react';
import { authApi } from '../../../application/services/adminApi';
import { useAuthStore } from '../../../application/stores/authStore';

interface SSOCallbackProps {
  onSuccess: () => void;
  onError: (message: string) => void;
}

function parseCallbackParams() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');
  const error = params.get('error');
  const errorDesc = params.get('error_description') || error || '';

  if (error) return { status: 'error' as const, errorMessage: errorDesc, code: null, state: null };
  if (!code || !state) return { status: 'error' as const, errorMessage: 'SSO 回调参数不完整', code: null, state: null };

  const savedState = useAuthStore.getState().getSsoState();
  if (savedState && savedState !== state) {
    useAuthStore.getState().clearSsoState();
    return { status: 'error' as const, errorMessage: 'SSO 状态校验失败，可能遭受 CSRF 攻击', code: null, state: null };
  }

  return { status: 'processing' as const, errorMessage: '', code, state };
}

export function SSOCallback({ onSuccess, onError }: SSOCallbackProps) {
  const initial = useMemo(() => parseCallbackParams(), []);
  const [status, setStatus] = useState(initial.status);
  const [errorMessage, setErrorMessage] = useState(initial.errorMessage);

  useEffect(() => {
    window.history.replaceState({}, '', window.location.pathname);

    if (initial.status === 'error') {
      onError(initial.errorMessage);
      return;
    }

    useAuthStore.getState().clearSsoState();

    authApi
      .ssoCallback(initial.code!, initial.state!)
      .then((res) => {
        if (res.authenticated && res.user) {
          useAuthStore.getState().setHmrUser(res.user);
          useAuthStore.getState().setAuthMethod('sso');
          onSuccess();
        } else {
          setStatus('error');
          setErrorMessage(res.error || 'SSO 认证失败');
          onError(res.error || 'SSO 认证失败');
        }
      })
      .catch((err) => {
        setStatus('error');
        const msg = (err as Error)?.message || 'SSO 回调处理失败';
        setErrorMessage(msg);
        onError(msg);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅挂载时执行一次（依赖稳定，有意省略）
  }, []);

  if (status === 'error') {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center max-w-sm">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
            <span className="material-symbols-outlined text-red-600">error</span>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">SSO 登录失败</h2>
          <p className="text-sm text-gray-500 mb-4">{errorMessage}</p>
          <button
            onClick={() => window.location.replace(window.location.pathname)}
            className="px-4 py-2 text-sm bg-[#007AFF] text-white rounded-lg hover:bg-[#0055CC] transition-colors"
          >
            返回登录
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-[#007AFF] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-gray-500">正在完成 SSO 认证…</p>
      </div>
    </div>
  );
}
