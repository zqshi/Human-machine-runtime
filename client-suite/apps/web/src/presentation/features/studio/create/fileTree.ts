/**
 * fileTree — sandbox 文件树构建纯函数(展示层 util,无 IO/无 React 依赖,可单测)。
 *
 * 后端 list_files(files.search 递归返回扁平 FileInfo[])→ buildFileTree 按路径层级构建树。
 * 前端文件树递归渲染子节点,无需递归调 API(search 一次返回子树)。
 */

/** sandbox 文件树条目(后端 list_files 返回,含相对 /workspace 的 path) */
export interface SandboxEntry {
  name: string;
  path: string;
  type: 'dir' | 'file';
}

/** sandbox 文件树节点(含子节点,递归展示) */
export interface FileNode {
  name: string;
  path: string;
  type: 'dir' | 'file';
  children?: FileNode[];
}

/**
 * 把扁平 SandboxEntry[] 构建为嵌套 FileNode 树。
 *
 * - 按 path 用 '/' 分割逐层构建;中间层强制为目录,最后一层用 entry 的 type。
 * - 自动推断:文件路径 a/b/c.ts 中间目录 a、b 不在 entries 时自动建为目录节点。
 * - 同层排序:目录在前,文件在后(便于浏览)。
 * - 节点去重:同 path 复用已有节点(若 search 返回重复)。
 */
export function buildFileTree(entries: SandboxEntry[]): FileNode[] {
  const root: FileNode[] = [];

  const findOrCreateChild = (
    nodes: FileNode[],
    name: string,
    path: string,
    isDir: boolean
  ): FileNode => {
    let node = nodes.find((n) => n.name === name);
    if (!node) {
      node = { name, path, type: isDir ? 'dir' : 'file', ...(isDir ? { children: [] } : {}) };
      nodes.push(node);
    }
    if (isDir && !node.children) node.children = [];
    return node;
  };

  for (const entry of entries) {
    const segs = entry.path.split('/').filter(Boolean);
    if (segs.length === 0) continue;
    let currentLevel = root;
    let currentPath = '';
    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i];
      currentPath = currentPath ? `${currentPath}/${seg}` : seg;
      const isLast = i === segs.length - 1;
      const isDir = isLast ? entry.type === 'dir' : true; // 中间层必为目录
      const node = findOrCreateChild(currentLevel, seg, currentPath, isDir);
      if (isDir) currentLevel = node.children!;
    }
  }

  // 同层排序:目录在前,文件在后
  const sortRecursive = (nodes: FileNode[]): FileNode[] => {
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    for (const n of nodes) if (n.children) sortRecursive(n.children);
    return nodes;
  };
  sortRecursive(root);

  return root;
}
