/**
 * DocumentEditorWithSettings — 文档编辑器+设置面板 (km_1/km_4/km_15 对齐)
 * 左侧: tiptap 富文本编辑器 (工具栏+正文)
 * 右侧: 文档设置面板 (标题/权限/高级设置/评论/有效期/版本)
 * 支持安全保护模式 (水印+禁止复制)
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { Icon } from '../../components/ui/Icon';
import { ToggleSwitch } from '../../components/ui/ToggleSwitch';
import { RealTimeComments } from './RealTimeComments';
import { useToastStore } from '../../../application/stores/toastStore';
import { useKnowledgeStore } from '../../../application/stores/knowledgeStore';
import { useUIStore } from '../../../application/stores/uiStore';
import { documentApi } from '../../../application/services/apiGateway';

import { PublishTargetModal } from './PublishTargetModal';

interface DocumentEditorWithSettingsProps {
  title?: string;
  secureMode?: boolean;
  documentId?: string;
  onClose?: () => void;
  onPublish?: () => void;
}

const DEFAULT_CONTENT = `<h1>新建文档</h1><p>在此处开始编辑你的文档内容……</p>`;

function EditorToolbar({ editor }: { editor: ReturnType<typeof useEditor> | null }) {
  if (!editor) return null;

  const btn = (icon: string, action: () => void, active?: boolean, title?: string) => (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault(); // prevent focus loss from editor
        action();
      }}
      className={`p-1.5 rounded transition-colors ${
        active ? 'text-primary bg-primary/10' : 'text-text-secondary hover:bg-bg-hover'
      }`}
      title={title}
    >
      <Icon name={icon} size={16} />
    </button>
  );

  const handleInsertLink = () => {
    const href = window.prompt('输入链接 URL:');
    if (!href) return;
    editor.chain().focus().setLink({ href }).run();
  };

  const handleInsertImage = () => {
    document.getElementById('editor-img-input')?.click();
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    editor.chain().focus().setImage({ src: url }).run();
    e.target.value = '';
  };

  return (
    <div className="flex items-center gap-1 px-4 py-1.5 border-b border-border shrink-0">
      {btn(
        'title',
        () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
        editor.isActive('heading', { level: 1 }),
        'H1'
      )}
      {btn(
        'format_bold',
        () => editor.chain().focus().toggleBold().run(),
        editor.isActive('bold'),
        '加粗'
      )}
      {btn(
        'format_italic',
        () => editor.chain().focus().toggleItalic().run(),
        editor.isActive('italic'),
        '斜体'
      )}
      {btn(
        'format_strikethrough',
        () => editor.chain().focus().toggleStrike().run(),
        editor.isActive('strike'),
        '删除线'
      )}
      <div className="w-px h-5 bg-border mx-1" />
      {btn(
        'format_list_bulleted',
        () => editor.chain().focus().toggleBulletList().run(),
        editor.isActive('bulletList'),
        '无序列表'
      )}
      {btn(
        'format_list_numbered',
        () => editor.chain().focus().toggleOrderedList().run(),
        editor.isActive('orderedList'),
        '有序列表'
      )}
      {btn(
        'format_quote',
        () => editor.chain().focus().toggleBlockquote().run(),
        editor.isActive('blockquote'),
        '引用'
      )}
      <div className="w-px h-5 bg-border mx-1" />
      {btn('image', handleInsertImage, false, '插入图片')}
      {btn(
        'attach_file',
        () => useToastStore.getState().addToast('附件功能即将上线', 'info'),
        false,
        '附件'
      )}
      {btn(
        'table_chart',
        () => useToastStore.getState().addToast('表格功能即将上线', 'info'),
        false,
        '表格'
      )}
      {btn('link', handleInsertLink, editor.isActive('link'), '插入链接')}
      <input
        id="editor-img-input"
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelected}
      />
    </div>
  );
}

export function DocumentEditorWithSettings({
  title: initialTitle = '新建文档',
  secureMode = false,
  documentId,
  onClose,
  onPublish,
}: DocumentEditorWithSettingsProps) {
  const [watermark, setWatermark] = useState(secureMode);
  const [noCopy, setNoCopy] = useState(secureMode);
  const [permission, setPermission] = useState<'all' | 'specific' | 'private'>('specific');
  const [showAdvanced, setShowAdvanced] = useState(secureMode);
  const [showComments, setShowComments] = useState(false);
  const [aiIndexing, setAiIndexing] = useState(true);
  const [docTitle, setDocTitle] = useState(initialTitle);
  const [currentDocId, setCurrentDocId] = useState<string | undefined>(documentId);
  const [docVersion, setDocVersion] = useState<number | undefined>();
  const [collaborators, setCollaborators] = useState<string[]>(['张', '李']);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [commentPerm, setCommentPerm] = useState('仅协作人可评论');
  const [expiryDate, setExpiryDate] = useState('2024-12-31');
  const coverInputRef = useRef<HTMLInputElement>(null);
  const { createDocument, updateDocument } = useKnowledgeStore();
  const selectedDocumentId = useKnowledgeStore((s) => s.selectedDocumentId);
  const storeDocuments = useKnowledgeStore((s) => s.documents);
  const setSubView = useUIStore((s) => s.setSubView);

  // Load from store if we have a selectedDocumentId and no explicit documentId prop
  const resolvedDocId = documentId || selectedDocumentId || undefined;

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: '开始编辑文档内容...' }),
      Link.configure({ openOnClick: false }),
      Image,
    ],
    content: resolvedDocId ? '' : DEFAULT_CONTENT,
    editable: true,
    immediatelyRender: false,
  });

  const storeDoc = resolvedDocId ? storeDocuments.find((d) => d.id === resolvedDocId) : undefined;
  const prevResolvedDocRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (resolvedDocId && storeDoc && resolvedDocId !== prevResolvedDocRef.current) {
      prevResolvedDocRef.current = resolvedDocId;
      setDocTitle(storeDoc.title);
      setCurrentDocId(storeDoc.id);
    }
  }, [resolvedDocId, storeDoc]);

  // Load existing doc from store or API
  useEffect(() => {
    if (!resolvedDocId || !editor) return;
    if (storeDoc) {
      editor.commands.setContent(storeDoc.content || DEFAULT_CONTENT);
      return;
    }
    // Fall back to API
    documentApi
      .get(resolvedDocId)
      .then(({ document: doc }) => {
        setDocTitle(doc.title);
        setDocVersion(doc.version);
        setCurrentDocId(resolvedDocId);
        const html = typeof doc.content?.html === 'string' ? doc.content.html : '';
        editor.commands.setContent(html || DEFAULT_CONTENT);
      })
      .catch(() => {
        useToastStore.getState().addToast('加载文档失败', 'error');
      });
  }, [resolvedDocId, editor, storeDoc]);

  const handleExport = () => {
    if (!editor) return;
    if (noCopy) {
      useToastStore.getState().addToast('安全模式下禁止导出', 'error');
      return;
    }
    const html = editor.getHTML();
    const blob = new Blob(
      [
        `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${docTitle}</title></head><body>${html}</body></html>`,
      ],
      { type: 'text/html' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${docTitle}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveDraft = async () => {
    if (!editor) return;
    const html = editor.getHTML();
    if (currentDocId) {
      const ok = await updateDocument(currentDocId, {
        title: docTitle,
        content: html,
        version: docVersion,
      });
      if (ok) {
        setDocVersion((v) => (v ? v + 1 : 1));
        useToastStore.getState().addToast('草稿已保存', 'success');
      } else {
        useToastStore.getState().addToast('保存失败', 'error');
      }
    } else {
      const newId = await createDocument(docTitle, 'doc', html);
      if (newId) {
        setCurrentDocId(newId);
        setDocVersion(1);
        useToastStore.getState().addToast('草稿已创建', 'success');
      } else {
        useToastStore.getState().addToast('创建失败', 'error');
      }
    }
  };

  const handlePublish = async () => {
    await handleSaveDraft();
    if (currentDocId) {
      setShowPublishModal(true);
    } else {
      useToastStore.getState().addToast('请先保存文档', 'info');
    }
  };

  const handleAddCollaborator = useCallback(() => {
    const name = window.prompt('输入协作人姓名:');
    if (!name?.trim()) return;
    const letter = name.trim().charAt(0);
    if (collaborators.includes(letter)) {
      useToastStore.getState().addToast(`${name} 已在协作列表中`, 'info');
      return;
    }
    setCollaborators((prev) => [...prev, letter]);
    useToastStore.getState().addToast(`已添加协作人: ${name}`, 'success');
  }, [collaborators]);

  const handleRemoveCollaborator = useCallback((letter: string) => {
    setCollaborators((prev) => prev.filter((l) => l !== letter));
    useToastStore.getState().addToast(`已移除协作人: ${letter}`, 'info');
  }, []);

  const handleCoverUpload = useCallback(() => {
    coverInputRef.current?.click();
  }, []);

  const handleCoverFileSelected = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      useToastStore.getState().addToast('请选择图片文件', 'error');
      return;
    }
    const url = URL.createObjectURL(file);
    setCoverUrl(url);
    useToastStore.getState().addToast('封面已上传', 'success');
    e.target.value = '';
  }, []);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-bg-white-var">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-text-muted hover:text-text-secondary"
          >
            <Icon name="close" size={18} />
          </button>
          <span className="text-sm font-semibold text-text-primary">{docTitle}</span>
          <span className="text-[10px] text-text-muted">自动保存 14:20</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExport}
            className="px-3 py-1.5 text-xs text-text-secondary border border-border rounded-lg hover:bg-bg-hover flex items-center gap-1"
          >
            <Icon name="ios_share" size={14} /> 导出
          </button>
          <button
            type="button"
            onClick={handleSaveDraft}
            className="px-3 py-1.5 text-xs text-text-secondary border border-border rounded-lg hover:bg-bg-hover"
          >
            保存草稿
          </button>
          <button
            type="button"
            onClick={handlePublish}
            className="px-3 py-1.5 text-xs font-medium text-white bg-primary rounded-lg hover:bg-primary/90"
          >
            发布
          </button>
        </div>
      </div>

      {/* Security warning */}
      {(watermark || noCopy) && (
        <div className="flex items-center gap-2 px-4 py-1.5 bg-warning/5 border-b border-warning/20 text-xs text-warning shrink-0">
          <Icon name="gpp_maybe" size={14} />
          <span className="font-medium">已启用安全保护：禁止复制内容及导出文件</span>
        </div>
      )}

      <div className="flex-1 flex min-h-0">
        {/* Editor area */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          {/* Toolbar */}
          <EditorToolbar editor={editor} />

          {/* Content — click anywhere to focus editor */}
          <div
            className={`flex-1 overflow-y-auto p-8 relative hmr-scrollbar ${noCopy ? 'select-none' : ''}`}
            onClick={() => {
              if (editor && !editor.isFocused) editor.commands.focus('end');
            }}
          >
            {/* Watermark overlay */}
            {watermark && (
              <div
                className="absolute inset-0 pointer-events-none overflow-hidden opacity-[0.04] z-20"
                style={{ transform: 'rotate(-30deg)', transformOrigin: 'center' }}
              >
                {Array.from({ length: 20 }, (_, i) => (
                  <p
                    key={i}
                    className="text-2xl font-bold text-text-primary whitespace-nowrap py-8"
                  >
                    内部保密 · 李明 · 2024-12-20 &nbsp;&nbsp;&nbsp;&nbsp; 内部保密 · 李明 ·
                    2024-12-20 &nbsp;&nbsp;&nbsp;&nbsp; 内部保密 · 李明 · 2024-12-20
                  </p>
                ))}
              </div>
            )}

            <div className="max-w-2xl mx-auto relative z-10">
              <EditorContent editor={editor} className="tiptap-editor text-text-primary" />

              {noCopy && (
                <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-black/80 backdrop-blur-md text-xs text-white shadow-xl">
                  <Icon name="lock" size={12} /> 文档已加密，无法复制
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right settings panel — min-h-0 enables flex child scroll */}
        <div className="w-80 border-l border-border flex flex-col min-h-0">
          <div className="px-4 py-3 border-b border-border shrink-0">
            <h3 className="text-sm font-semibold text-text-primary">文档设置</h3>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-5 hmr-scrollbar">
            {/* Title */}
            <div>
              <label className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1.5 block">
                展示标题
              </label>
              <input
                type="text"
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {/* Access permission */}
            <section>
              <h4 className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2">
                访问权限
              </h4>
              <div className="space-y-2">
                {[
                  { key: 'all' as const, label: '全员公开', desc: '企业内所有人可阅读' },
                  { key: 'specific' as const, label: '指定人员', desc: '仅特定成员或部门可见' },
                  { key: 'private' as const, label: '仅我可见', desc: '仅本人可查看和编辑' },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setPermission(opt.key)}
                    className={`w-full text-left p-3 rounded-xl border transition-colors ${
                      permission === opt.key
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-bg-hover/50'
                    }`}
                  >
                    <p className="text-xs font-medium text-text-primary">{opt.label}</p>
                    <p className="text-[10px] text-text-muted">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </section>

            {/* Collaborators */}
            <section>
              <h4 className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2">
                协作人员
              </h4>
              <div className="flex items-center gap-2 flex-wrap">
                {collaborators.map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => handleRemoveCollaborator(l)}
                    title={`点击移除 ${l}`}
                    className="w-7 h-7 rounded-full bg-primary text-white text-[10px] font-medium flex items-center justify-center ring-2 ring-white hover:bg-error transition-colors"
                  >
                    {l}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleAddCollaborator}
                  className="w-7 h-7 rounded-full border-2 border-dashed border-border flex items-center justify-center text-text-muted hover:border-primary hover:text-primary transition-colors"
                  title="添加协作人"
                >
                  <Icon name="add" size={14} />
                </button>
              </div>
            </section>

            {/* Document cover */}
            <section>
              <label className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1.5 block">
                文档封面
              </label>
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleCoverFileSelected}
              />
              {coverUrl ? (
                <div className="relative group">
                  <img
                    src={coverUrl}
                    alt="文档封面"
                    className="w-full h-24 object-cover rounded-xl border border-border"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={handleCoverUpload}
                      className="px-2 py-1 rounded-lg bg-white/90 text-xs font-medium text-text-primary hover:bg-white"
                    >
                      更换
                    </button>
                    <button
                      type="button"
                      onClick={() => setCoverUrl(null)}
                      className="px-2 py-1 rounded-lg bg-white/90 text-xs font-medium text-error hover:bg-white"
                    >
                      移除
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleCoverUpload}
                  className="w-full h-20 rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 text-text-muted hover:border-primary hover:text-primary cursor-pointer transition-colors"
                >
                  <Icon name="add_photo_alternate" size={20} />
                  <span className="text-[10px]">点击上传封面图</span>
                </button>
              )}
            </section>

            {/* Advanced settings */}
            <section>
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-1 text-xs font-semibold text-text-secondary"
              >
                <Icon name={showAdvanced ? 'expand_more' : 'chevron_right'} size={16} />
                高级设置
              </button>

              {showAdvanced && (
                <div className="mt-3 space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-xl border border-border">
                    <div>
                      <p className="text-xs text-text-primary">水印设置</p>
                      <p className="text-[10px] text-text-muted">在文档背景显示安全水印</p>
                    </div>
                    <ToggleSwitch checked={watermark} onChange={setWatermark} />
                  </div>

                  <div
                    className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${noCopy ? 'border-primary bg-primary/5' : 'border-border'}`}
                  >
                    <div>
                      <p className="text-xs text-text-primary">防复制/导出</p>
                      <p className="text-[10px] text-text-muted">禁止复制文本及导出PDF</p>
                    </div>
                    <ToggleSwitch checked={noCopy} onChange={setNoCopy} />
                  </div>
                  {noCopy && (
                    <p className="text-[10px] text-primary flex items-center gap-1 px-1">
                      <Icon name="verified_user" size={12} /> 安全保护生效中
                    </p>
                  )}

                  <div className="flex items-center justify-between p-3 rounded-xl border border-border">
                    <div>
                      <p className="text-xs text-text-primary">AI 检索</p>
                      <p className="text-[10px] text-text-muted">发布后同步到 AI 知识库</p>
                    </div>
                    <ToggleSwitch checked={aiIndexing} onChange={setAiIndexing} />
                  </div>
                </div>
              )}
            </section>

            {/* Comment permission */}
            <div>
              <label className="text-xs text-text-secondary mb-1 block">评论权限</label>
              <select
                value={commentPerm}
                onChange={(e) => setCommentPerm(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-border rounded-lg bg-white"
              >
                <option>仅协作人可评论</option>
                <option>所有人可评论</option>
              </select>
              <button
                type="button"
                onClick={() => setShowComments(true)}
                className="mt-1.5 text-[10px] text-primary hover:underline"
              >
                查看实时评论 →
              </button>
            </div>
            {showComments && <RealTimeComments onClose={() => setShowComments(false)} />}

            {/* Expiry */}
            <div>
              <label className="text-xs text-text-secondary mb-1 block">文档有效期</label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <p className="text-[10px] text-text-muted mt-1">到期后文档将自动归档</p>
            </div>

            {/* Version history */}
            <button
              type="button"
              onClick={() => setSubView('knowledge:version-history')}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-border text-xs text-text-secondary hover:bg-bg-hover"
            >
              <Icon name="history" size={16} /> 版本历史记录
            </button>
          </div>
        </div>
      </div>

      {showPublishModal && currentDocId && (
        <PublishTargetModal
          documentId={currentDocId}
          documentTitle={docTitle}
          onClose={() => setShowPublishModal(false)}
          onPublished={() => {
            setShowPublishModal(false);
            onPublish?.();
          }}
        />
      )}
    </div>
  );
}
