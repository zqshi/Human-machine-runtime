/**
 * DocumentSettingsPanel — 文档设置面板 (km_1 对齐)
 * 展示标题/分类/访问权限/协作人员/高级设置(水印/评论/有效期/防复制)
 */
import { useState, useMemo } from 'react';
import { Icon } from '../../components/ui/Icon';
import { Avatar } from '../../components/ui/Avatar';
import { ToggleSwitch } from '../../components/ui/ToggleSwitch';
import { SectionLabel } from '../../components/ui/SectionLabel';
import { useToastStore } from '../../../application/stores/toastStore';
import { useKnowledgeStore } from '../../../application/stores/knowledgeStore';
import { SYSTEM_CATEGORIES } from '../../../domain/knowledge/Category';

type AccessLevel = 'public' | 'specific' | 'private';

const ACCESS_OPTIONS: { key: AccessLevel; label: string; desc: string; icon: string }[] = [
  { key: 'public', label: '全员公开', desc: '企业内所有人可阅读', icon: 'public' },
  { key: 'specific', label: '指定人员', desc: '仅特定成员或部门可见', icon: 'group' },
  { key: 'private', label: '仅我可见', desc: '私密文档，仅自己可访问', icon: 'lock' },
];

interface DocumentSettingsPanelProps {
  onClose?: () => void;
}

export function DocumentSettingsPanel({ onClose }: DocumentSettingsPanelProps) {
  const selectedDocumentId = useKnowledgeStore((s) => s.selectedDocumentId);
  const documents = useKnowledgeStore((s) => s.documents);
  const doc = useMemo(() => documents.find((d) => d.id === selectedDocumentId), [documents, selectedDocumentId]);

  const [access, setAccess] = useState<AccessLevel>('public');
  const sec = doc?.securitySettings;
  const [watermark, setWatermark] = useState(sec?.watermark ?? true);
  const [preventCopy, setPreventCopy] = useState(sec?.preventCopy ?? false);
  const [collabs, setCollabs] = useState<string[]>(['张', '李']);
  const [title, setTitle] = useState(doc?.title ?? '');
  const [category, setCategory] = useState(doc?.categoryId ?? 'cat-official');
  const [commentPerm, setCommentPerm] = useState('所有人可评论');
  const [expiryDate, setExpiryDate] = useState(doc?.expiryDate ?? '2024-12-31');

  return (
    <div className="w-80 border-l border-border bg-bg-secondary flex flex-col min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <h3 className="text-sm font-semibold text-text-primary">文档设置</h3>
        {onClose && (
          <button type="button" onClick={onClose} className="p-1 rounded-md hover:bg-bg-hover text-text-secondary">
            <Icon name="close" size={18} />
          </button>
        )}
      </div>

      <div className="flex-1 p-4 space-y-5 overflow-y-auto dcf-scrollbar">
        {/* Display title */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-text-secondary">展示标题</label>
          <input
            type="text"
            placeholder="输入用于显示的简短标题"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-bg-white-var focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {/* Category */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-text-secondary">选择分类</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-bg-white-var focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none">
            {SYSTEM_CATEGORIES.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>

        {/* Access level */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-text-secondary">访问权限</label>
          <div className="space-y-1.5">
            {ACCESS_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setAccess(opt.key)}
                className={`w-full flex items-start gap-2.5 p-2.5 rounded-lg border transition-colors text-left ${
                  access === opt.key
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-border-primary'
                }`}
              >
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center mt-0.5 shrink-0 ${
                  access === opt.key ? 'border-primary' : 'border-border'
                }`}>
                  {access === opt.key && <div className="w-2 h-2 rounded-full bg-primary" />}
                </div>
                <div>
                  <p className="text-xs font-medium text-text-primary">{opt.label}</p>
                  <p className="text-[10px] text-text-muted mt-0.5">{opt.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Collaborators */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-text-secondary">协作人员</label>
          <div className="flex items-center gap-1 flex-wrap">
            {collabs.map((l) => (
              <button key={l} type="button" onClick={() => { setCollabs((p) => p.filter((x) => x !== l)); useToastStore.getState().addToast(`已移除 ${l}`, 'info'); }} title={`点击移除 ${l}`}>
                <Avatar letter={l} size={28} />
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                const name = window.prompt('输入协作人姓名:');
                if (!name?.trim()) return;
                const letter = name.trim().charAt(0);
                if (collabs.includes(letter)) { useToastStore.getState().addToast(`${name} 已存在`, 'info'); return; }
                setCollabs((p) => [...p, letter]);
                useToastStore.getState().addToast(`已添加 ${name}`, 'success');
              }}
              className="w-7 h-7 rounded-full border border-dashed border-border-primary flex items-center justify-center text-text-muted hover:border-primary hover:text-primary transition-colors"
            >
              <Icon name="add" size={14} />
            </button>
          </div>
        </div>

        {/* Advanced settings */}
        <div className="space-y-3">
          <SectionLabel>高级设置</SectionLabel>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-text-primary">水印设置</p>
              <p className="text-[10px] text-text-muted">在文档背景显示安全水印</p>
            </div>
            <ToggleSwitch checked={watermark} onChange={setWatermark} />
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-text-primary">评论权限</p>
            <select value={commentPerm} onChange={(e) => setCommentPerm(e.target.value)} className="w-full px-3 py-1.5 text-xs border border-border rounded-lg bg-bg-white-var focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none">
              <option>所有人可评论</option>
              <option>仅协作者可评论</option>
              <option>禁止评论</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-text-primary">文档有效期</p>
            <input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="w-full px-3 py-1.5 text-xs border border-border rounded-lg bg-bg-white-var focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <p className="text-[10px] text-text-muted">到期后文档将自动归档且无法访问</p>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-text-primary">防复制/导出</p>
              <p className="text-[10px] text-text-muted">禁止复制文本及导出 PDF</p>
            </div>
            <ToggleSwitch checked={preventCopy} onChange={setPreventCopy} />
          </div>
        </div>
      </div>
    </div>
  );
}
