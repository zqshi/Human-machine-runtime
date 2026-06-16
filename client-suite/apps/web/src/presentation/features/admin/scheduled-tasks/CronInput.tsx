import { useState, useEffect } from 'react';
import {
  scheduledTaskApi,
  type CronValidation,
} from '../../../../application/services/adminApi';

interface Props {
  value: string;
  onChange: (v: string) => void;
  tz?: string;
}

/** Cron 表达式输入 + 防抖实时校验 + 人类可读描述 + 下 3 次触发预览 */
export function CronInput({ value, onChange, tz = 'Asia/Shanghai' }: Props) {
  const [validation, setValidation] = useState<CronValidation | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!value.trim()) {
      setValidation(null);
      return;
    }
    setLoading(true);
    const t = setTimeout(() => {
      scheduledTaskApi
        .validateCron(value, tz)
        .then(setValidation)
        .catch(() => setValidation(null))
        .finally(() => setLoading(false));
    }, 400);
    return () => clearTimeout(t);
  }, [value, tz]);

  return (
    <div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="如：0 9 * * 1（每周一 9:00）"
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#007AFF] font-mono"
      />
      <div className="mt-1.5 text-xs">
        {loading ? (
          <span className="text-gray-400">校验中…</span>
        ) : validation ? (
          validation.valid ? (
            <span className="text-green-600">✓ {validation.description}</span>
          ) : (
            <span className="text-red-500">✗ {validation.error}</span>
          )
        ) : null}
      </div>
      {validation?.valid && validation.next5.length > 0 && (
        <div className="mt-1 text-[11px] text-gray-400">
          接下来：
          {validation.next5
            .slice(0, 3)
            .map((t) => new Date(t).toLocaleString('zh-CN'))
            .join('、')}
        </div>
      )}
    </div>
  );
}
