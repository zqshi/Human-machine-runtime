/**
 * FrequencyPicker —— 人类友好的频率选择器（替代裸 cron/interval 输入）
 *
 * 模式：固定间隔 / 每天 / 每周 / 每月 / 自定义 Cron
 * 底层仍生成 scheduleType + cronExpr/intervalSeconds，与后端契约一致。
 */

import { useState, useEffect, useRef } from 'react';
import { type FreqMode, type FreqConfig, inferMode } from './jobSpecs';
import { CronInput } from './CronInput';

const inputCls =
  'w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#007AFF]';

const MODES: { value: FreqMode; label: string }[] = [
  { value: 'interval', label: '固定间隔' },
  { value: 'daily', label: '每天' },
  { value: 'weekly', label: '每周' },
  { value: 'monthly', label: '每月' },
  { value: 'cron', label: '自定义' },
];

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

interface Parsed {
  mode: FreqMode;
  intervalN: number;
  intervalUnit: 'min' | 'hour';
  time: string; // HH:MM
  weekday: number; // 0-6
  monthDay: number; // 1-31
  cronExpr: string;
}

function parseConfig(v: FreqConfig): Parsed {
  const mode = inferMode(v);
  const base: Parsed = {
    mode,
    intervalN: 5,
    intervalUnit: 'min',
    time: '09:00',
    weekday: 1,
    monthDay: 1,
    cronExpr: v.cronExpr ?? '',
  };
  if (mode === 'interval') {
    const sec = v.intervalSeconds ?? 300;
    if (sec >= 3600 && sec % 3600 === 0) {
      base.intervalN = sec / 3600;
      base.intervalUnit = 'hour';
    } else {
      base.intervalN = Math.max(1, Math.round(sec / 60));
      base.intervalUnit = 'min';
    }
    return base;
  }
  const parts = (v.cronExpr ?? '0 9 * * *').split(/\s+/);
  const m = parts[0] ?? '0';
  const h = parts[1] ?? '9';
  base.time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  if (mode === 'weekly') base.weekday = Number(parts[4]) || 1;
  if (mode === 'monthly') base.monthDay = Number(parts[2]) || 1;
  return base;
}

function buildConfig(mode: FreqMode, p: Parsed): FreqConfig {
  if (mode === 'interval') {
    return {
      scheduleType: 'interval',
      intervalSeconds: p.intervalUnit === 'hour' ? p.intervalN * 3600 : p.intervalN * 60,
    };
  }
  const [hh, mm] = p.time.split(':');
  if (mode === 'daily') return { scheduleType: 'cron', cronExpr: `${mm} ${hh} * * *` };
  if (mode === 'weekly') return { scheduleType: 'cron', cronExpr: `${mm} ${hh} * * ${p.weekday}` };
  if (mode === 'monthly') return { scheduleType: 'cron', cronExpr: `${mm} ${hh} ${p.monthDay} * *` };
  return { scheduleType: 'cron', cronExpr: p.cronExpr };
}

export function FrequencyPicker({
  value,
  onChange,
  allowedModes,
}: {
  value: FreqConfig;
  onChange: (v: FreqConfig) => void;
  /** 限制可选频次（如周期报告只允许 weekly/monthly）；不填则全部可选 */
  allowedModes?: FreqMode[];
}) {
  const visibleModes = allowedModes
    ? MODES.filter((m) => allowedModes.includes(m.value))
    : MODES;
  const [p, setP] = useState<Parsed>(() => {
    const parsed = parseConfig(value);
    // 当前频次不在允许范围（如编辑旧任务）→ 回落到允许的第一个
    if (allowedModes && !allowedModes.includes(parsed.mode) && allowedModes.length > 0) {
      parsed.mode = allowedModes[0];
    }
    return parsed;
  });
  const firstRef = useRef(true);

  useEffect(() => {
    if (firstRef.current) {
      firstRef.current = false;
      return;
    }
    onChange(buildConfig(p.mode, p));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.mode, p.intervalN, p.intervalUnit, p.time, p.weekday, p.monthDay, p.cronExpr]);

  const setMode = (mode: FreqMode) => setP((prev) => ({ ...prev, mode }));

  return (
    <div className="space-y-2">
      <div className="flex gap-1.5 flex-wrap">
        {visibleModes.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => setMode(m.value)}
            className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${
              p.mode === m.value ? 'bg-[#007AFF] text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {p.mode === 'interval' && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">每</span>
          <input
            type="number"
            min={1}
            className={`${inputCls} w-20`}
            value={p.intervalN}
            onChange={(e) => setP({ ...p, intervalN: Math.max(1, Number(e.target.value)) })}
          />
          <select
            className={inputCls}
            value={p.intervalUnit}
            onChange={(e) => setP({ ...p, intervalUnit: e.target.value as 'min' | 'hour' })}
          >
            <option value="min">分钟</option>
            <option value="hour">小时</option>
          </select>
          <span className="text-xs text-gray-500">执行一次</span>
        </div>
      )}

      {(p.mode === 'daily' || p.mode === 'weekly' || p.mode === 'monthly') && (
        <div className="flex items-center gap-2 flex-wrap">
          {p.mode === 'weekly' && (
            <select
              className={inputCls}
              value={p.weekday}
              onChange={(e) => setP({ ...p, weekday: Number(e.target.value) })}
            >
              {WEEKDAYS.map((w, i) => (
                <option key={i} value={i}>
                  {w}
                </option>
              ))}
            </select>
          )}
          {p.mode === 'monthly' && (
            <>
              <span className="text-xs text-gray-500">每月</span>
              <input
                type="number"
                min={1}
                max={31}
                className={`${inputCls} w-16`}
                value={p.monthDay}
                onChange={(e) => setP({ ...p, monthDay: Math.min(31, Math.max(1, Number(e.target.value))) })}
              />
              <span className="text-xs text-gray-500">号</span>
            </>
          )}
          <input
            type="time"
            className={inputCls}
            value={p.time}
            onChange={(e) => setP({ ...p, time: e.target.value })}
          />
          <span className="text-xs text-gray-500">执行</span>
        </div>
      )}

      {p.mode === 'cron' && (
        <CronInput
          value={p.cronExpr}
          onChange={(v) => setP({ ...p, cronExpr: v })}
        />
      )}

      <div className="text-[11px] text-gray-400 font-mono">
        {buildConfig(p.mode, p).cronExpr && `cron: ${buildConfig(p.mode, p).cronExpr}`}
        {buildConfig(p.mode, p).intervalSeconds && `间隔: ${buildConfig(p.mode, p).intervalSeconds}s`}
      </div>
    </div>
  );
}
