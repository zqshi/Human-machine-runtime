import { useState, useEffect } from 'react';
import { Drawer } from '../../components/ui/Drawer';
import { Modal } from '../../components/ui/Modal';
import { Icon } from '../../components/ui/Icon';
import { skillApi } from '../../../application/services/adminApi';

interface Props {
  open: boolean;
  skillId: string | null;
  onClose: () => void;
}

interface VersionInfo {
  version?: string;
  changelog?: string;
  fileSize?: number;
  files?: string[];
  moderationStatus?: string;
  createdAt?: number | string;
  toolCount?: number;
  resourceCount?: number;
  promptCount?: number;
  downloadCount?: number;
}

export function SkillDetailDrawer({ open, skillId, onClose }: Props) {
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'readme' | 'versions'>('info');
  const [linkEmployeeId, setLinkEmployeeId] = useState('');
  const [employees, setEmployees] = useState<Record<string, unknown>[]>([]);
  const [viewingFile, setViewingFile] = useState<{ name: string; content: string } | null>(null);
  const [fileLoading, setFileLoading] = useState(false);

  const [prevKey, setPrevKey] = useState({ open, skillId });
  if ((open !== prevKey.open || skillId !== prevKey.skillId) && open && skillId) {
    setPrevKey({ open, skillId });
    setLoading(true);
    setShowJson(false);
    setActiveTab('info');
    setViewingFile(null);
  }

  useEffect(() => {
    if (!open || !skillId) return;
    skillApi
      .get(skillId)
      .then((raw) => {
        if (raw && typeof raw === 'object' && 'skill' in raw) {
          const { skill, latestVersion, owner, ...rest } = raw as Record<string, unknown>;
          setDetail({
            ...(skill as Record<string, unknown>),
            latestVersion,
            owner,
            ...rest,
          });
        } else {
          setDetail(raw);
        }
      })
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
    skillApi
      .listEmployees()
      .then((data) => setEmployees(Array.isArray(data) ? data : []))
      .catch(() => setEmployees([]));
  }, [open, skillId]);

  const handleLink = async () => {
    if (!skillId || !linkEmployeeId) return;
    try {
      await skillApi.link(skillId, { employeeId: linkEmployeeId });
      const updated = await skillApi.get(skillId);
      if (updated && typeof updated === 'object' && 'skill' in updated) {
        const { skill, latestVersion, owner, ...rest } = updated as Record<string, unknown>;
        setDetail({ ...(skill as Record<string, unknown>), latestVersion, owner, ...rest });
      } else {
        setDetail(updated);
      }
      setLinkEmployeeId('');
    } catch {
      /* ignore */
    }
  };

  const handleUnlink = async (employeeId: string) => {
    if (!skillId) return;
    try {
      await skillApi.unlink(skillId, { employeeId });
      const updated = await skillApi.get(skillId);
      if (updated && typeof updated === 'object' && 'skill' in updated) {
        const { skill, latestVersion, owner, ...rest } = updated as Record<string, unknown>;
        setDetail({ ...(skill as Record<string, unknown>), latestVersion, owner, ...rest });
      } else {
        setDetail(updated);
      }
    } catch {
      /* ignore */
    }
  };

  const handleViewFile = async (filename: string, version?: string) => {
    if (!skillId) return;
    setFileLoading(true);
    try {
      const res = await skillApi.getFileContent(skillId, filename, version);
      setViewingFile({ name: res.filename, content: res.content });
    } catch {
      setViewingFile({ name: filename, content: '无法加载文件内容' });
    } finally {
      setFileLoading(false);
    }
  };

  if (!open) return null;

  const latestVersion = detail?.latestVersion as Record<string, unknown> | undefined;
  const readme = String(latestVersion?.readme || '');
  const versions = (detail?.versions || []) as VersionInfo[];
  const ownerInfo = detail?.owner as Record<string, unknown> | undefined;
  const hasReadme = readme.length > 0;
  const hasVersions = versions.length > 0;

  return (
    <>
      <Drawer open={open} onClose={onClose} title="技能详情" width="w-[540px]">
        {loading ? (
          <div className="text-gray-400 text-sm py-6 text-center">加载中...</div>
        ) : !detail ? (
          <div className="text-gray-400 text-sm py-6 text-center">无数据</div>
        ) : (
          <div className="space-y-3">
            {/* Tab 切换 */}
            <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
              {(
                [
                  ['info', '基本信息'],
                  ...(hasReadme ? [['readme', 'README']] : []),
                  ...(hasVersions ? [['versions', '版本/文件']] : []),
                ] as [string, string][]
              ).map(([k, l]) => (
                <button
                  key={k}
                  onClick={() => setActiveTab(k as typeof activeTab)}
                  className={`flex-1 px-3 py-1.5 text-xs rounded-md transition-colors ${
                    activeTab === k
                      ? 'bg-white text-gray-800 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>

            {/* ─── 基本信息 Tab ─── */}
            {activeTab === 'info' && (
              <div className="space-y-3">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                  <DetailField label="ID" value={detail.slug || detail.id} />
                  <DetailField label="名称" value={detail.displayName || detail.name} />
                  <DetailField
                    label="标签"
                    value={
                      Array.isArray(detail.tags)
                        ? (detail.tags as string[]).join(', ')
                        : detail.category
                    }
                  />
                  <DetailField label="来源" value={detail.source} />
                  <DetailField label="版本" value={latestVersion?.version || detail.version} />
                  <DetailField label="状态" value={detail.moderationStatus || detail.status} />
                  <DetailField
                    label="下载量"
                    value={
                      (detail.stats as Record<string, unknown>)?.totalDownloads ?? detail.calls
                    }
                  />
                  <DetailField label="创建时间" value={formatTs(detail.createdAt)} />
                  <DetailField
                    label="作者"
                    value={
                      ownerInfo
                        ? `${ownerInfo.displayName || ownerInfo.handle || '—'}`
                        : (detail.author as Record<string, unknown>)?.handle
                    }
                  />
                  <DetailField label="可见性" value={detail.visibility} />
                </dl>

                {detail.description || detail.summary ? (
                  <div>
                    <dt className="text-xs text-gray-400 mb-0.5">描述</dt>
                    <dd className="text-sm text-gray-700">
                      {String(detail.description || detail.summary)}
                    </dd>
                  </div>
                ) : null}

                {latestVersion?.changelog ? (
                  <div>
                    <dt className="text-xs text-gray-400 mb-0.5">最新 Changelog</dt>
                    <dd className="text-sm text-gray-700">{String(latestVersion.changelog)}</dd>
                  </div>
                ) : null}

                {/* 关联员工 */}
                {detail.source !== 'hub' && (
                  <div className="border-t border-gray-100 pt-2.5">
                    <h4 className="text-xs font-medium text-gray-500 mb-1.5">关联员工</h4>
                    {Array.isArray(detail.linkedEmployees) && detail.linkedEmployees.length > 0 ? (
                      <div className="space-y-1 mb-2">
                        {(detail.linkedEmployees as Record<string, unknown>[]).map((emp) => (
                          <div
                            key={String(emp.id)}
                            className="flex items-center justify-between text-xs bg-gray-50 px-2 py-1 rounded"
                          >
                            <span>{String(emp.name || emp.id)}</span>
                            <button
                              onClick={() => handleUnlink(String(emp.id))}
                              className="text-red-400 hover:text-red-600"
                            >
                              <Icon name="link_off" size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 mb-2">暂无关联</p>
                    )}
                    <div className="flex items-center gap-2">
                      <select
                        value={linkEmployeeId}
                        onChange={(e) => setLinkEmployeeId(e.target.value)}
                        className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded-lg"
                      >
                        <option value="">选择员工...</option>
                        {employees.map((emp) => (
                          <option key={String(emp.id)} value={String(emp.id)}>
                            {String(emp.displayName || emp.name || emp.id)}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={handleLink}
                        disabled={!linkEmployeeId}
                        className="px-2 py-1 text-xs bg-[#007AFF] text-white rounded-lg disabled:opacity-50"
                      >
                        绑定
                      </button>
                    </div>
                  </div>
                )}

                {/* 原始 JSON */}
                <div className="border-t border-gray-100 pt-2.5">
                  <button
                    onClick={() => setShowJson(!showJson)}
                    className="text-xs text-[#007AFF] hover:underline"
                  >
                    {showJson ? '收起 JSON' : '查看原始 JSON'}
                  </button>
                  {showJson && (
                    <pre className="mt-2 text-xs font-mono bg-gray-50 p-3 rounded border border-gray-100 overflow-x-auto max-h-60 overflow-y-auto">
                      {JSON.stringify(detail, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            )}

            {/* ─── README Tab ─── */}
            {activeTab === 'readme' && (
              <div className="prose prose-sm max-w-none">
                <MarkdownRenderer content={readme} />
              </div>
            )}

            {/* ─── 版本/文件 Tab ─── */}
            {activeTab === 'versions' && (
              <div className="space-y-2.5">
                {versions.map((v, i) => (
                  <div key={i} className="border border-gray-100 rounded-lg p-2.5 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-800">v{v.version}</span>
                      <span className="text-xs text-gray-400">{formatTs(v.createdAt)}</span>
                    </div>
                    {v.changelog && <p className="text-xs text-gray-600">{v.changelog}</p>}
                    <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                      {v.fileSize != null && (
                        <span>
                          <Icon name="folder" size={12} className="mr-0.5 align-[-1px]" />
                          {formatBytes(v.fileSize)}
                        </span>
                      )}
                      {(v.toolCount ?? 0) > 0 && <span>工具: {v.toolCount}</span>}
                      {(v.resourceCount ?? 0) > 0 && <span>资源: {v.resourceCount}</span>}
                      {(v.promptCount ?? 0) > 0 && <span>Prompt: {v.promptCount}</span>}
                      {(v.downloadCount ?? 0) > 0 && <span>下载: {v.downloadCount}</span>}
                    </div>
                    {v.files && v.files.length > 0 && (
                      <div>
                        <dt className="text-xs text-gray-400 mb-1">文件列表 ({v.files.length})</dt>
                        <div className="flex flex-col gap-1">
                          {v.files.map((f) => (
                            <button
                              key={f}
                              onClick={() => handleViewFile(f, v.version)}
                              className="inline-flex items-center px-2.5 py-1 text-xs bg-gray-50 border border-gray-100 rounded font-mono text-gray-600 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-colors text-left w-full"
                            >
                              <Icon
                                name="description"
                                size={14}
                                className="mr-1.5 text-gray-400 shrink-0"
                              />
                              <span className="truncate">{f}</span>
                              <Icon
                                name="open_in_new"
                                size={12}
                                className="ml-auto text-gray-300 shrink-0"
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {v.moderationStatus && (
                      <span className="inline-flex px-2 py-0.5 text-xs rounded-full bg-green-50 text-green-700">
                        {v.moderationStatus}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* 文件内容查看 Modal */}
      <Modal
        open={!!viewingFile || fileLoading}
        onClose={() => setViewingFile(null)}
        title={viewingFile?.name || '加载中...'}
        width="max-w-3xl"
      >
        {fileLoading ? (
          <div className="text-gray-400 text-sm py-8 text-center">加载文件内容...</div>
        ) : viewingFile ? (
          <pre className="text-xs font-mono bg-gray-50 p-4 rounded-lg border border-gray-100 overflow-auto max-h-[70vh] whitespace-pre-wrap break-words">
            {viewingFile.content}
          </pre>
        ) : null}
      </Modal>
    </>
  );
}

function DetailField({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <dt className="text-xs text-gray-400">{label}</dt>
      <dd className="text-sm text-gray-800">
        {value === null || value === undefined ? '—' : String(value)}
      </dd>
    </div>
  );
}

function formatTs(ts: unknown): string {
  if (!ts) return '—';
  const d = typeof ts === 'number' ? new Date(ts) : new Date(String(ts));
  if (isNaN(d.getTime())) return String(ts);
  return d.toLocaleString('zh-CN', { dateStyle: 'short', timeStyle: 'short' });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function MarkdownRenderer({ content }: { content: string }) {
  const html = simpleMarkdownToHtml(content);
  return (
    <div
      className="text-sm text-gray-700 leading-relaxed [&_h1]:text-lg [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-1.5 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1 [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:mb-2 [&_ol]:list-decimal [&_ol]:pl-4 [&_ol]:mb-2 [&_li]:mb-0.5 [&_code]:bg-gray-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono [&_pre]:bg-gray-50 [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-gray-100 [&_pre]:overflow-x-auto [&_pre]:mb-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_table]:w-full [&_table]:border-collapse [&_table]:mb-3 [&_th]:border [&_th]:border-gray-200 [&_th]:px-2 [&_th]:py-1 [&_th]:bg-gray-50 [&_th]:text-left [&_th]:text-xs [&_td]:border [&_td]:border-gray-200 [&_td]:px-2 [&_td]:py-1 [&_td]:text-xs [&_blockquote]:border-l-3 [&_blockquote]:border-gray-300 [&_blockquote]:pl-3 [&_blockquote]:text-gray-500 [&_blockquote]:italic [&_blockquote]:mb-2 [&_hr]:my-4 [&_hr]:border-gray-200 [&_a]:text-[#007AFF] [&_a]:underline [&_strong]:font-semibold"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function simpleMarkdownToHtml(md: string): string {
  let html = md.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  html = html.replace(/^```(\w*)\n([\s\S]*?)```/gm, (_m, _lang, code) => {
    return `<pre><code>${code.trim()}</code></pre>`;
  });
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/^#{3}\s+(.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^#{2}\s+(.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^#{1}\s+(.+)$/gm, '<h1>$1</h1>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  html = html.replace(/^---$/gm, '<hr/>');
  html = html.replace(/^&gt;\s+(.+)$/gm, '<blockquote><p>$1</p></blockquote>');

  html = html.replace(
    /^(\|.+\|)\n(\|[-| :]+\|)\n((?:\|.+\|\n?)+)/gm,
    (_m, header: string, _sep: string, body: string) => {
      const ths = header
        .split('|')
        .filter((c: string) => c.trim())
        .map((c: string) => `<th>${c.trim()}</th>`)
        .join('');
      const rows = body
        .trim()
        .split('\n')
        .map((row: string) => {
          const tds = row
            .split('|')
            .filter((c: string) => c.trim())
            .map((c: string) => `<td>${c.trim()}</td>`)
            .join('');
          return `<tr>${tds}</tr>`;
        })
        .join('');
      return `<table><thead><tr>${ths}</tr></thead><tbody>${rows}</tbody></table>`;
    }
  );

  html = html.replace(/^[-*]\s+(.+)$/gm, '<li>$1</li>');
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');
  html = html.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');

  html = html
    .split('\n\n')
    .map((block) => {
      const trimmed = block.trim();
      if (
        !trimmed ||
        trimmed.startsWith('<h') ||
        trimmed.startsWith('<pre') ||
        trimmed.startsWith('<ul') ||
        trimmed.startsWith('<ol') ||
        trimmed.startsWith('<table') ||
        trimmed.startsWith('<blockquote') ||
        trimmed.startsWith('<hr')
      ) {
        return trimmed;
      }
      return `<p>${trimmed.replace(/\n/g, '<br/>')}</p>`;
    })
    .join('\n');

  return html;
}
