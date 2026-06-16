/**
 * DocumentSecurityPanel — 文档高级安全设置面板 (km_14 对齐)
 * 水印设置(内容选项) + 安全防护(复制/下载/外部分享) + 文档信息
 */
import { useState, useMemo } from 'react';
import { Icon } from '../../components/ui/Icon';
import { ToggleSwitch } from '../../components/ui/ToggleSwitch';
import { useUIStore } from '../../../application/stores/uiStore';
import { useKnowledgeStore } from '../../../application/stores/knowledgeStore';

interface DocumentSecurityPanelProps {
  onClose?: () => void;
}

const WATERMARK_OPTIONS = ['用户名', '工号', '内部机密'];

export function DocumentSecurityPanel({ onClose }: DocumentSecurityPanelProps) {
  const selectedDocumentId = useKnowledgeStore((s) => s.selectedDocumentId);
  const documents = useKnowledgeStore((s) => s.documents);
  const doc = useMemo(
    () => documents.find((d) => d.id === selectedDocumentId),
    [documents, selectedDocumentId]
  );

  const sec = doc?.securitySettings;
  const [watermark, setWatermark] = useState(sec?.watermark ?? true);
  const [activeWatermark, setActiveWatermark] = useState('透明度');
  const [watermarkContent, setWatermarkContent] = useState('用户名');
  const [preventCopy, setPreventCopy] = useState(sec?.preventCopy ?? true);
  const [preventDownload, setPreventDownload] = useState(sec?.preventDownload ?? true);
  const [allowExternal, setAllowExternal] = useState(false);

  return (
    <div className="w-80 border-l border-border bg-bg-secondary overflow-y-auto flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-text-primary">高级设置</h3>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md hover:bg-bg-hover text-text-secondary"
          >
            <Icon name="settings" size={18} />
          </button>
        )}
      </div>

      <div className="flex-1 p-4 space-y-6 overflow-y-auto">
        {/* Watermark settings */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="text-xs font-bold text-text-primary">水印设置</h4>
              <p className="text-[10px] text-text-muted mt-0.5">在文档背景显示安全水印</p>
            </div>
            <ToggleSwitch checked={watermark} onChange={setWatermark} />
          </div>

          {watermark && (
            <div className="space-y-2.5">
              <div>
                <p className="text-[10px] text-text-muted mb-1.5">水印内容</p>
                <div className="flex items-center gap-1.5">
                  {WATERMARK_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setWatermarkContent(opt)}
                      className={`px-3 py-1.5 text-[11px] font-medium rounded-lg border transition-colors ${
                        watermarkContent === opt
                          ? 'border-primary text-primary bg-primary/5'
                          : 'border-border text-text-secondary hover:border-primary hover:text-primary'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveWatermark(activeWatermark === '透明度' ? '密度' : '透明度')}
                className="text-[11px] text-primary font-medium border-b border-primary"
              >
                {activeWatermark}
              </button>
            </div>
          )}
        </section>

        <div className="h-px bg-border" />

        {/* Security protection */}
        <section>
          <h4 className="text-xs font-bold text-text-primary mb-1">安全防护</h4>
          <p className="text-[10px] text-text-muted mb-3">控制文档的分发与传播</p>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-primary">禁止复制内容</span>
              <div className="flex items-center gap-2">
                {preventCopy && <Icon name="check_circle" size={16} className="text-primary" />}
                <ToggleSwitch checked={preventCopy} onChange={setPreventCopy} />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-text-primary">禁止下载/导出</span>
              <div className="flex items-center gap-2">
                {preventDownload && <Icon name="check_circle" size={16} className="text-primary" />}
                <ToggleSwitch checked={preventDownload} onChange={setPreventDownload} />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-text-primary">允许外部链接分享</span>
              <ToggleSwitch checked={allowExternal} onChange={setAllowExternal} />
            </div>
          </div>
        </section>

        <div className="h-px bg-border" />

        {/* Document info */}
        <section>
          <h4 className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-3">
            文档信息
          </h4>
          <div className="space-y-2">
            <InfoRow label="创建者" value={doc?.author.name ?? '-'} />
            <InfoRow label="文件大小" value={doc?.size ?? '-'} />
            <InfoRow label="所在位置" value={doc ? `/ ${doc.departmentId ?? '未分类'}` : '-'} />
          </div>
        </section>
      </div>

      {/* Version history button */}
      <div className="p-4 border-t border-border">
        <button
          type="button"
          onClick={() => useUIStore.getState().setSubView('knowledge:version-history')}
          className="w-full py-2.5 rounded-xl border border-border text-sm font-medium text-text-secondary hover:bg-bg-hover transition-colors flex items-center justify-center gap-2"
        >
          <Icon name="history" size={16} />
          版本历史记录
        </button>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] text-text-muted">{label}</span>
      <span className="text-[11px] text-text-primary font-medium">{value}</span>
    </div>
  );
}
