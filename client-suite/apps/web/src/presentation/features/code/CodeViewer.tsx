/**
 * CodeViewer — VS Code Dark+ 主题代码查看器
 * 支持行号、语法高亮 CSS 类、文件头信息栏
 */
import { useState, useCallback } from 'react';
import { Icon } from '../../components/ui/Icon';
import { Button } from '../../components/ui/Button';

interface CodeViewerProps {
  code: string;
  language: string;
  fileName: string;
}

function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}

export function CodeViewer({ code, language, fileName }: CodeViewerProps) {
  const [copied, setCopied] = useState(false);
  const lines = code.split('\n');

  const handleCopy = useCallback(() => {
    copyToClipboard(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // Clipboard API not available (e.g. HTTP page)
    });
  }, [code]);

  return (
    <div className="flex flex-col rounded-lg overflow-hidden border border-[#333]" style={{ backgroundColor: '#1e1e1e' }}>
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#333]" style={{ backgroundColor: '#252526' }}>
        <div className="flex items-center gap-2">
          <Icon name="description" size={14} className="text-[#858585]" />
          <span className="text-xs font-mono text-[#cccccc]">{fileName}</span>
          <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#264f78] text-[#d4d4d4]">
            {language}
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={handleCopy} className="text-[#858585] hover:text-[#d4d4d4] hover:bg-[#333]">
          <Icon name={copied ? 'check' : 'content_copy'} size={14} />
          <span className="ml-1 text-[11px]">{copied ? '已复制' : '复制'}</span>
        </Button>
      </div>

      {/* Code area */}
      <div className="flex-1 overflow-auto" style={{ fontFamily: "'Fira Code', monospace", fontSize: 13 }}>
        <pre className="m-0 p-0">
          <table className="border-collapse w-full">
            <tbody>
              {lines.map((line, i) => (
                <tr key={i} className="hover:bg-[#2a2d2e]">
                  <td
                    className="select-none text-right pr-4 pl-4 py-0 w-[1%] whitespace-nowrap align-top"
                    style={{ color: '#858585', fontSize: 13, fontFamily: "'Fira Code', monospace" }}
                  >
                    {i + 1}
                  </td>
                  <td className="pr-4 py-0 whitespace-pre" style={{ color: '#d4d4d4' }}>
                    {line}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </pre>
      </div>
    </div>
  );
}

/*
 * Syntax highlighting CSS classes (apply to tokens within code lines):
 *
 * .token-keyword  { color: #569CD6; }  -- blue
 * .token-string   { color: #CE9178; }  -- orange
 * .token-comment  { color: #6A9955; }  -- green
 * .token-function { color: #DCDCAA; }  -- yellow
 * .token-number   { color: #B5CEA8; }  -- light green
 */
