/**
 * LoginPage — 登录页
 * 支持 Matrix 账密登录、企业 SSO
 * 通过 variant 区分三个平台的品牌展示
 */
import { useState, useEffect, useRef } from 'react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Icon } from '../components/ui/Icon';

type Variant = 'user' | 'admin' | 'ops';

const BRAND: Record<
  Variant,
  {
    icon: string | null;
    letter: string | null;
    logoGradient: string;
    bg: string;
    dots: [string, string, string];
    title: string;
    sub: string;
    tags: string[];
  }
> = {
  user: {
    icon: null,
    letter: 'D',
    logoGradient: 'from-[#007AFF] to-[#0055CC]',
    bg: 'from-blue-50 via-white to-indigo-50',
    dots: ['bg-[#007AFF]/5', 'bg-indigo-400/5', 'bg-blue-400/5'],
    title: 'HMR 数字员工协作平台',
    sub: '登录以开始使用',
    tags: [],
  },
  admin: {
    icon: 'shield_person',
    letter: null,
    logoGradient: 'from-slate-700 to-slate-900',
    bg: 'from-slate-50 via-white to-gray-50',
    dots: ['bg-slate-400/5', 'bg-gray-400/5', 'bg-slate-300/5'],
    title: 'Admin Console',
    sub: '管理 Agent、技能与 AI 服务',
    tags: ['Agent 管理', 'AI Gateway', '运营监控'],
  },
  ops: {
    icon: 'domain',
    letter: null,
    logoGradient: 'from-indigo-600 to-indigo-800',
    bg: 'from-indigo-50 via-white to-purple-50',
    dots: ['bg-indigo-400/5', 'bg-purple-400/5', 'bg-indigo-300/5'],
    title: '运营管理平台',
    sub: '租户运营与平台监控',
    tags: ['多租户管理', '平台配置', '审计日志'],
  },
};

interface LoginPageProps {
  variant?: Variant;
  onLogin: (homeserver: string, username: string, password: string) => Promise<void>;
  onSsoLogin?: (homeserver: string) => void;
  onHmrSsoLogin?: () => void;
}

const AUTH_MODE = (import.meta.env.VITE_AUTH_MODE as string) || 'auto';

export function LoginPage({
  variant = 'user',
  onLogin,
  onSsoLogin,
  onHmrSsoLogin,
}: LoginPageProps) {
  const [homeserver, setHomeserver] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState('');

  const brand = BRAND[variant];
  const ssoAutoTriggered = useRef(false);

  // SSO-only 模式：自动触发 SSO 登录，无需用户点击
  useEffect(() => {
    if (AUTH_MODE === 'sso' && onHmrSsoLogin && !ssoAutoTriggered.current) {
      ssoAutoTriggered.current = true;
      onHmrSsoLogin();
    }
  }, [onHmrSsoLogin]);

  const handleLogin = async () => {
    if (!username || !password) return;
    setLoading(true);
    setError('');
    try {
      const hs = homeserver || window.location.origin;
      await onLogin(hs, username, password);
    } catch (e) {
      setError((e as Error).message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`h-full flex items-center justify-center bg-gradient-to-br ${brand.bg} relative overflow-hidden`}
    >
      {/* Decorative background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className={`absolute -top-20 -left-20 w-60 h-60 rounded-full ${brand.dots[0]} animate-pulse`}
        />
        <div
          className={`absolute top-1/3 -right-10 w-40 h-40 rounded-full ${brand.dots[1]} animate-pulse [animation-delay:1s]`}
        />
        <div
          className={`absolute -bottom-10 left-1/3 w-48 h-48 rounded-full ${brand.dots[2]} animate-pulse [animation-delay:2s]`}
        />
      </div>
      <Card className="w-[380px] p-8 backdrop-blur-xl bg-white/80 shadow-lg login-card-in">
        {/* Logo & Brand */}
        <div className="flex flex-col items-center mb-6">
          <div
            className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${brand.logoGradient} flex items-center justify-center text-white mb-3`}
          >
            {brand.icon ? (
              <Icon name={brand.icon} size={28} className="text-white" />
            ) : (
              <span className="font-bold text-xl">{brand.letter}</span>
            )}
          </div>
          <h1 className="text-xl font-bold text-text-primary">{brand.title}</h1>
          <p className="text-sm text-text-secondary mt-1">{brand.sub}</p>
          {brand.tags.length > 0 && (
            <div className="flex gap-1.5 mt-2">
              {brand.tags.map((t) => (
                <span
                  key={t}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Login form */}
        <div className="space-y-3">
          {AUTH_MODE !== 'sso' && (
            <>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="用户名"
                className="w-full h-10 px-3 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="密码"
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                className="w-full h-10 px-3 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />

              {error && <p className="text-xs text-error">{error}</p>}

              <Button
                onClick={handleLogin}
                disabled={loading || !username || !password}
                className="w-full"
                size="lg"
              >
                {loading ? '登录中...' : '登录'}
              </Button>

              <div className="flex items-center gap-2 text-text-muted text-xs">
                <span className="flex-1 border-t border-border" />
                <span>或</span>
                <span className="flex-1 border-t border-border" />
              </div>
            </>
          )}

          {AUTH_MODE !== 'sso' && onSsoLogin && (
            <Button
              variant="ghost"
              onClick={() => {
                const hs = homeserver || window.location.origin;
                onSsoLogin(hs);
              }}
              disabled={loading}
              className="w-full"
              size="lg"
            >
              Matrix SSO 登录
            </Button>
          )}

          {onHmrSsoLogin && (
            <Button
              variant={AUTH_MODE === 'sso' ? 'primary' : 'ghost'}
              onClick={onHmrSsoLogin}
              disabled={loading}
              className="w-full"
              size="lg"
            >
              企业 SSO 登录
            </Button>
          )}
        </div>

        {/* Advanced */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="mt-4 text-xs text-text-muted hover:text-primary"
        >
          {showAdvanced ? '收起' : '高级设置'}
        </button>
        {showAdvanced && (
          <div className="mt-2">
            <input
              type="text"
              value={homeserver}
              onChange={(e) => setHomeserver(e.target.value)}
              placeholder="Homeserver 地址 (可选)"
              className="w-full h-9 px-3 rounded-lg border border-border text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        )}
      </Card>
    </div>
  );
}
