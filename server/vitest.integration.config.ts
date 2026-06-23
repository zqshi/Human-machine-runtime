import { defineConfig } from 'vitest/config';

/**
 * 集成测试独立配置:仅运行 *.integration.test.ts,默认与 unit 套件隔离。
 *
 * 触发方式:
 *   CLAUDE_WORKER_E2E=1 npx vitest run --config vitest.integration.config.ts
 *
 * 集成测试默认 skip(参见各 .integration.test.ts 内 describe.skipIf 用法),
 * 需显式提供 CLUDE_WORKER_E2E=1 才执行,避免污染 CI unit 套件。
 */
export default defineConfig({
  test: {
    include: ['src/**/*.integration.test.ts'],
    globals: true,
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
