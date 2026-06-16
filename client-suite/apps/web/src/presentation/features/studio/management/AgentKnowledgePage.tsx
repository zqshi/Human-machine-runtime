/**
 * AgentKnowledgePage — 知识库管理
 *
 * 左栏: KB 列表（新建/切换/删除）
 * 右栏: 文档 CRUD（上传文件 / 添加链接 / 列表）
 *
 * 增删 KB 时同步更新 orchestrationStore.knowledgeBaseIds
 */
import { useState, useCallback, useEffect } from 'react';
import { useToastStore } from '../../../../application/stores/toastStore';
import { useOrchestrationStore } from '../../../../application/stores/orchestrationStore';
import { Icon } from '../../../components/ui/Icon';

interface KnowledgeBase {
  id: string;
  name: string;
  docCount: number;
  tag: string;
}

interface KnDoc {
  id: string;
  name: string;
  type: 'file' | 'link';
  size?: string;
  url?: string;
  addedAt: string;
}

export function AgentKnowledgePage() {
  const toast = useToastStore((s) => s.addToast);
  const updateOrchestrationField = useOrchestrationStore((s) => s.updateField);

  const [kbs, setKbs] = useState<KnowledgeBase[]>([
    { id: 'kb1', name: '产品文档', docCount: 12, tag: '核心' },
    { id: 'kb2', name: '技术规范', docCount: 5, tag: '参考' },
  ]);
  const [activeKbId, setActiveKbId] = useState('kb1');
  const [showNewKb, setShowNewKb] = useState(false);
  const [newKbName, setNewKbName] = useState('');

  // 文档列表
  const [docs, setDocs] = useState<Record<string, KnDoc[]>>({
    kb1: [
      { id: 'd1', name: 'SQL优化指南.pdf', type: 'file', size: '2.3 MB', addedAt: '2026-05-20' },
      { id: 'd2', name: '索引设计规范.md', type: 'file', size: '45 KB', addedAt: '2026-05-22' },
      {
        id: 'd3',
        name: 'PostgreSQL 官方文档',
        type: 'link',
        url: 'https://www.postgresql.org/docs/',
        addedAt: '2026-05-25',
      },
    ],
    kb2: [
      { id: 'd4', name: 'API 接口文档.md', type: 'file', size: '120 KB', addedAt: '2026-06-01' },
    ],
  });

  const [showAddLink, setShowAddLink] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkName, setLinkName] = useState('');

  const activeKb = kbs.find((k) => k.id === activeKbId);
  const activeDocs = docs[activeKbId] || [];

  // 同步 KB IDs 到 orchestrationStore
  const syncKbIds = useCallback(
    (updatedKbs: KnowledgeBase[]) => {
      updateOrchestrationField(
        'knowledgeBaseIds',
        updatedKbs.map((k) => k.id)
      );
    },
    [updateOrchestrationField]
  );

  // 初始同步
  useEffect(() => {
    syncKbIds(kbs);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const createKb = () => {
    if (!newKbName.trim()) {
      toast('请输入名称', 'error');
      return;
    }
    const id = `kb${Date.now()}`;
    const updated = [...kbs, { id, name: newKbName.trim(), docCount: 0, tag: '自定义' }];
    setKbs(updated);
    setDocs((prev) => ({ ...prev, [id]: [] }));
    setActiveKbId(id);
    setNewKbName('');
    setShowNewKb(false);
    syncKbIds(updated);
    toast('知识库已创建', 'success');
  };

  const deleteKb = (id: string) => {
    if (kbs.length <= 1) {
      toast('至少保留一个知识库', 'error');
      return;
    }
    const updated = kbs.filter((k) => k.id !== id);
    setKbs(updated);
    const newDocs = { ...docs };
    delete newDocs[id];
    setDocs(newDocs);
    if (activeKbId === id) setActiveKbId(updated[0].id);
    syncKbIds(updated);
    toast('已删除', 'success');
  };

  const handleUpload = useCallback(() => {
    // 模拟上传
    const newDoc: KnDoc = {
      id: `d${Date.now()}`,
      name: `上传文档_${Date.now().toString(36)}.pdf`,
      type: 'file',
      size: '1.2 MB',
      addedAt: '2026-06-05',
    };
    setDocs((prev) => ({ ...prev, [activeKbId]: [...(prev[activeKbId] || []), newDoc] }));
    toast('文档已上传', 'success');
  }, [activeKbId, toast]);

  const addLink = () => {
    if (!linkUrl.trim()) {
      toast('请输入 URL', 'error');
      return;
    }
    const newDoc: KnDoc = {
      id: `d${Date.now()}`,
      name: linkName.trim() || linkUrl.trim(),
      type: 'link',
      url: linkUrl.trim(),
      addedAt: '2026-06-05',
    };
    setDocs((prev) => ({ ...prev, [activeKbId]: [...(prev[activeKbId] || []), newDoc] }));
    setLinkUrl('');
    setLinkName('');
    setShowAddLink(false);
    toast('链接已添加', 'success');
  };

  const removeDoc = (docId: string) => {
    setDocs((prev) => ({
      ...prev,
      [activeKbId]: (prev[activeKbId] || []).filter((d) => d.id !== docId),
    }));
    toast('已移除', 'success');
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Page-level header — 与编排配置/基础管理/发布管理/运营监控风格一致 */}
      <header className="h-[48px] flex items-center justify-between px-6 border-b border-white/[0.08] bg-white/[0.02] shrink-0">
        <h2 className="text-[14px] font-semibold text-slate-100">知识库管理</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddLink(true)}
            className="h-7 px-3 rounded-lg text-[11px] font-medium border border-white/[0.15] text-slate-300 hover:bg-white/[0.06]"
          >
            🔗 添加链接
          </button>
          <button
            onClick={handleUpload}
            className="h-7 px-3 rounded-lg text-[11px] font-medium bg-primary text-white hover:opacity-90"
          >
            📎 上传文件
          </button>
        </div>
      </header>

      {/* Two-column content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: KB list */}
        <div className="w-52 flex flex-col border-r border-white/[0.06] shrink-0">
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/[0.06]">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              知识库列表
            </span>
            <button
              onClick={() => setShowNewKb(true)}
              className="text-[10px] text-primary font-medium"
            >
              + 新建
            </button>
          </div>

          {showNewKb && (
            <div className="px-3 py-2 border-b border-white/[0.06]">
              <input
                value={newKbName}
                onChange={(e) => setNewKbName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && createKb()}
                placeholder="知识库名称"
                className="w-full h-7 px-2 border border-white/[0.08] bg-white/[0.03] rounded text-[11px] outline-none text-slate-200 placeholder:text-slate-500 focus:border-primary/50"
                autoFocus
              />
              <div className="flex items-center gap-2 mt-1.5">
                <button onClick={createKb} className="text-[10px] text-primary">
                  确认
                </button>
                <button
                  onClick={() => {
                    setShowNewKb(false);
                    setNewKbName('');
                  }}
                  className="text-[10px] text-slate-400"
                >
                  取消
                </button>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-2 dcf-scrollbar">
            {kbs.map((kb) => (
              <div
                key={kb.id}
                onClick={() => setActiveKbId(kb.id)}
                className={`group w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left transition-all mb-1 cursor-pointer ${
                  activeKbId === kb.id
                    ? 'bg-primary/10 text-primary'
                    : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-200'
                }`}
              >
                <Icon name="menu_book" size={14} />
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-medium truncate">{kb.name}</div>
                  <div className="text-[9px] text-slate-500">{kb.docCount} 篇文档</div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteKb(kb.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 text-red-400 text-[8px]"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Documents */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Sub-header: 当前 KB 名称 */}
          <div className="h-[40px] flex items-center gap-2 px-6 border-b border-white/[0.06] bg-white/[0.01] shrink-0">
            <Icon name="menu_book" size={14} className="text-primary" />
            <span className="text-[13px] font-medium text-slate-200">{activeKb?.name}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] text-slate-400">
              {activeKb?.tag}
            </span>
            <span className="text-[10px] text-slate-500">· {activeDocs.length} 篇文档</span>
          </div>

          <div className="flex-1 overflow-y-auto p-6 dcf-scrollbar">
            {/* 添加链接 */}
            {showAddLink && (
              <div className="mb-4 p-3 border border-primary/30 bg-primary/[0.04] rounded-xl w-full max-w-2xl">
                <div className="space-y-2">
                  <input
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full h-8 px-3 border border-white/[0.08] bg-white/[0.03] rounded-lg text-[12px] outline-none text-slate-200 placeholder:text-slate-500 focus:border-primary/50"
                    autoFocus
                  />
                  <input
                    value={linkName}
                    onChange={(e) => setLinkName(e.target.value)}
                    placeholder="显示名称（可选）"
                    className="w-full h-8 px-3 border border-white/[0.08] bg-white/[0.03] rounded-lg text-[12px] outline-none text-slate-200 placeholder:text-slate-500 focus:border-primary/50"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={addLink}
                      className="h-7 px-3 rounded-lg text-[10px] font-medium bg-primary text-white hover:opacity-90"
                    >
                      添加
                    </button>
                    <button
                      onClick={() => {
                        setShowAddLink(false);
                        setLinkUrl('');
                        setLinkName('');
                      }}
                      className="text-[10px] text-slate-400"
                    >
                      取消
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 上传区域提示 */}
            <div
              onClick={handleUpload}
              className="mb-4 border-2 border-dashed border-white/[0.1] rounded-2xl p-8 text-center cursor-pointer hover:border-primary/30 hover:bg-primary/[0.02] transition-all w-full max-w-2xl"
            >
              <Icon name="upload_file" size={28} className="text-slate-500 mx-auto mb-2" />
              <div className="text-[12px] text-slate-400">拖拽文件到此处，或点击上传</div>
              <div className="text-[10px] text-slate-500 mt-1">
                支持 PDF / Markdown / TXT，可多选
              </div>
            </div>

            {/* 文档列表 */}
            <div className="space-y-1.5 w-full max-w-2xl">
              {activeDocs.length === 0 && (
                <div className="text-center py-8 text-slate-500 text-[12px]">暂无文档</div>
              )}
              {activeDocs.map((doc) => (
                <div
                  key={doc.id}
                  className="group flex items-center gap-3 p-3 rounded-xl border border-white/[0.08] bg-white/[0.03]"
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      doc.type === 'file' ? 'bg-primary/10' : 'bg-emerald-500/10'
                    }`}
                  >
                    <Icon
                      name={doc.type === 'file' ? 'description' : 'link'}
                      size={16}
                      className={doc.type === 'file' ? 'text-primary' : 'text-emerald-400'}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-medium text-slate-200 truncate">
                      {doc.name}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {doc.type === 'file' ? doc.size : doc.url} · {doc.addedAt}
                    </div>
                  </div>
                  <button
                    onClick={() => removeDoc(doc.id)}
                    className="opacity-0 group-hover:opacity-100 text-red-400 text-[9px] transition-opacity"
                  >
                    移除
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
