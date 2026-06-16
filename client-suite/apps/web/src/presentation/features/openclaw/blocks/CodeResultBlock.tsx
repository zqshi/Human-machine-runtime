import { useCallback, useState } from 'react';
import { Icon } from '../../../components/ui/Icon';
import type { OpenClawDrawerContent } from '../../../../domain/agent/DrawerContent';

interface Props {
  language: string;
  code: string;
  fileName?: string;
  onOpen: (content: OpenClawDrawerContent) => void;
}

export function CodeResultBlockComponent({ language, code, fileName, onOpen }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [code]);

  const label = fileName || language;

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
        <span className="text-[11px] font-medium text-slate-400">{label}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-200 transition-colors"
            onClick={handleCopy}
          >
            <Icon name={copied ? 'check' : 'content_copy'} size={12} />
            {copied ? '已复制' : '复制'}
          </button>
          <button
            type="button"
            className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-200 transition-colors ml-2"
            onClick={() =>
              onOpen({
                type: 'code-viewer',
                title: label,
                data: { language, code },
              })
            }
          >
            <Icon name="open_in_full" size={12} />
            展开
          </button>
        </div>
      </div>

      {/* Code */}
      <pre className="font-mono text-[11px] text-slate-200 bg-black/30 p-3 overflow-x-auto max-h-[200px]">
        <code>{code}</code>
      </pre>
    </div>
  );
}
