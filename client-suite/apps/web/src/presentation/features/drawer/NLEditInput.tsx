import { useState, type KeyboardEvent } from 'react';
import { useToastStore } from '../../../application/stores/toastStore';

export function NLEditInput() {
  const [value, setValue] = useState('');
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (e.key === 'Enter' && value.trim()) {
      e.preventDefault();
      useToastStore.getState().addToast(`NL 编辑指令已发送: "${value.trim()}"`, 'info');
      setValue('');
    }
  };
  return (
    <div className="p-3 border-t border-border min-w-[360px]">
      <input
        type="text" value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={handleKeyDown}
        placeholder="用自然语言描述修改... (Enter 发送)"
        className="w-full h-8 px-3 rounded-lg border border-border bg-bg-light text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
    </div>
  );
}
