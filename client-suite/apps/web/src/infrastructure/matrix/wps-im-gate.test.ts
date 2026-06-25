import { describe, it, expect, afterEach, vi } from 'vitest';
import { isWpsImEnabled } from './wps-im-gate';

describe('isWpsImEnabled (D11 守卫)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('VITE_WPS_IM_ENABLED 未设置时返回 false(投产默认禁用)', () => {
    vi.stubEnv('VITE_WPS_IM_ENABLED', '');
    expect(isWpsImEnabled()).toBe(false);
  });

  it('VITE_WPS_IM_ENABLED 为 "false" 时返回 false', () => {
    vi.stubEnv('VITE_WPS_IM_ENABLED', 'false');
    expect(isWpsImEnabled()).toBe(false);
  });

  it('VITE_WPS_IM_ENABLED 为 "true" 时返回 true(显式启用)', () => {
    vi.stubEnv('VITE_WPS_IM_ENABLED', 'true');
    expect(isWpsImEnabled()).toBe(true);
  });

  it('大小写敏感:"True"/"TRUE" 不视为启用(防误开)', () => {
    vi.stubEnv('VITE_WPS_IM_ENABLED', 'True');
    expect(isWpsImEnabled()).toBe(false);
    vi.stubEnv('VITE_WPS_IM_ENABLED', 'TRUE');
    expect(isWpsImEnabled()).toBe(false);
  });
});
