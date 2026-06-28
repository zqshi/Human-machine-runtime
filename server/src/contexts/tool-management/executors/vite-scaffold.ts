/**
 * Vite + React + TS 脚手架注入(轻应用预览兜底)。
 *
 * 背景:轻应用对话式创建时,LLM 经 tool-loop(write_file)只建业务文件(如 src/App.tsx),
 * 常漏建 package.json/index.html/vite.config 等运行前置 → 预览报 "no package.json"
 * 或 vite dev 起不来。本 module 在预览前检测 /workspace,缺 package.json 则注入最小可运行
 * 脚手架,保证 npm install + vite dev 直接能跑。LLM 业务文件叠加其上(同名覆盖)。
 *
 * 架构:提纯自 routes/cockpit/bootstrap.ts 预览路由(§12 信号6:route 不堆业务逻辑)。
 * 依赖 @alibaba-group/opensandbox 的 Sandbox 类型(executor 本属 infrastructure 层)。
 */
import type { Sandbox } from '@alibaba-group/opensandbox';

/** 脚手架文件清单(相对 /workspace 的路径)。最小可运行 vite+React+TS。 */
export const VITE_SCAFFOLD_FILES: Array<{ path: string; content: string }> = [
  {
    path: 'package.json',
    content: JSON.stringify(
      {
        name: 'app-studio',
        private: true,
        version: '0.0.0',
        type: 'module',
        scripts: { dev: 'vite --host', build: 'tsc && vite build', preview: 'vite preview' },
        dependencies: {
          react: '^18.3.1',
          'react-dom': '^18.3.1',
        },
        devDependencies: {
          '@types/react': '^18.3.3',
          '@types/react-dom': '^18.3.0',
          '@vitejs/plugin-react': '^4.3.1',
          typescript: '^5.5.3',
          vite: '^5.4.0',
        },
      },
      null,
      2
    ),
  },
  {
    path: 'index.html',
    content: `<!doctype html>
<html lang="zh">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>App Studio</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,
  },
  {
    path: 'vite.config.ts',
    content: `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// strictPort:true 端口被占时直接失败(而非悄悄退到 5174),避免 probe 查 5173 误判。
export default defineConfig({
  plugins: [react()],
  server: { host: true, port: 5173, strictPort: true },
});
`,
  },
  {
    path: 'tsconfig.json',
    content: JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2020',
          useDefineForClassFields: true,
          lib: ['ES2020', 'DOM', 'DOM.Iterable'],
          module: 'ESNext',
          skipLibCheck: true,
          moduleResolution: 'bundler',
          allowImportingTsExtensions: true,
          resolveJsonModule: true,
          isolatedModules: true,
          noEmit: true,
          jsx: 'react-jsx',
          strict: true,
        },
        include: ['src'],
      },
      null,
      2
    ),
  },
  {
    path: 'src/main.tsx',
    content: `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`,
  },
  {
    path: 'src/App.tsx',
    content: `export default function App() {
  return (
    <div style={{ fontFamily: 'system-ui', padding: 24 }}>
      <h1>Hello App Studio</h1>
      <p>应用脚手架已就绪。让 AI 修改 src/App.tsx 实现你的需求。</p>
    </div>
  );
}
`,
  },
  {
    path: 'src/index.css',
    content: `:root { color-scheme: light dark; }
body { margin: 0; }
`,
  },
];

const WORKSPACE = '/workspace';

/** 试读 /workspace/package.json;存在返回 true,不存在(含目录未建)返回 false。 */
async function hasPackageJson(sb: Sandbox): Promise<boolean> {
  try {
    await sb.files.readFile(`${WORKSPACE}/package.json`);
    return true;
  } catch {
    return false;
  }
}

/**
 * 确保 sandbox 工作区有可运行的 vite 脚手架。
 * - 已有 package.json → 不注入(injected=false,尊重 LLM 已建的项目)
 * - 无(含 /workspace 目录尚未创建) → 注入脚手架,但 src/App.tsx 若已存在则跳过(不覆盖 LLM 业务代码)
 *
 * 注:用 readFile 而非 search 判断存在性——search 在目录不存在时抛错被吞,会误判;
 *     writeFiles 写 /workspace/x 时 SDK 自动建父目录,故首次注入即建出工作区。
 * 容错:任何失败不抛(预览是兜底,失败让后续 npm install/vite dev 报更具体的错)。
 */
export async function ensureViteSandbox(sb: Sandbox): Promise<{ injected: boolean }> {
  try {
    if (await hasPackageJson(sb)) {
      return { injected: false };
    }
    // src/App.tsx 是业务入口:LLM 可能已写,脚手架占位不应覆盖。
    let appTsxExists = false;
    try {
      await sb.files.readFile(`${WORKSPACE}/src/App.tsx`);
      appTsxExists = true;
    } catch {
      // not found → LLM 未写,脚手架占位注入
    }
    const filesToWrite = appTsxExists
      ? VITE_SCAFFOLD_FILES.filter((f) => f.path !== 'src/App.tsx')
      : VITE_SCAFFOLD_FILES;
    await sb.files.writeFiles(
      filesToWrite.map((f) => ({
        path: `${WORKSPACE}/${f.path}`,
        data: f.content,
        mode: 0o644,
      }))
    );
    return { injected: true };
  } catch {
    return { injected: false };
  }
}
