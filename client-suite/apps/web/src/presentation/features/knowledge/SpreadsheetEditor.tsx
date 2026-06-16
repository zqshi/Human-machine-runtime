/**
 * SpreadsheetEditor — 在线电子表格协同编辑 (spreadsheet_collaborative_edit 对齐)
 * 菜单栏 + 工具栏 + 公式栏 + 表格网格 + 左侧属性面板 + 底部状态栏
 */
import { useState } from 'react';
import { Icon } from '../../components/ui/Icon';
import { useToastStore } from '../../../application/stores/toastStore';
import { SpreadsheetAIFormula } from './SpreadsheetAIFormula';

interface CellData {
  value: string;
  style?: 'currency' | 'percent' | 'progress' | 'name-tag' | 'date';
  progressColor?: string;
  progressPercent?: number;
  tagColor?: string;
}

interface HistoryEntry {
  user: string;
  color: string;
  action: string;
  time: string;
}

const COLUMNS = ['A', 'B', 'C', 'D', 'E'];
const COL_HEADERS = ['项目名称', '当前预算 (CNY)', '执行进度', '负责人', '截止日期'];

const ROWS: CellData[][] = [
  [
    { value: '云服务迁移' },
    { value: '¥ 1,280,000.00', style: 'currency' },
    { value: '75%', style: 'progress', progressColor: '#34C759', progressPercent: 75 },
    { value: '小明', style: 'name-tag', tagColor: '#FF9500' },
    { value: '2024-09-30', style: 'date' },
  ],
  [
    { value: 'AI 模型训练' },
    { value: '¥ 4,500,000.00', style: 'currency' },
    { value: '32%', style: 'progress', progressColor: '#007AFF', progressPercent: 32 },
    { value: '李建国' },
    { value: '2024-12-15', style: 'date' },
  ],
  [
    { value: '渠道商峰会' },
    { value: '¥ 820,000.00', style: 'currency' },
    { value: '100%', style: 'progress', progressColor: '#FF9500', progressPercent: 100 },
    { value: '陈美美' },
    { value: '2024-08-01', style: 'date' },
  ],
];

const HISTORY: HistoryEntry[] = [
  { user: 'Alice', color: '#007AFF', action: '修改了 B2 单元格', time: '刚刚' },
  { user: 'Bob', color: '#FF9500', action: '更新了 预算状态', time: '2 分钟前' },
];

const MENU_ITEMS = ['文件', '编辑', '视图', '插入', '格式', '数据'];

interface SpreadsheetEditorProps {
  onExit?: () => void;
}

export function SpreadsheetEditor({ onExit }: SpreadsheetEditorProps) {
  const [selectedCell, setSelectedCell] = useState('B2');
  const [showPanel, setShowPanel] = useState(true);
  const [showAIFormula, setShowAIFormula] = useState(false);
  const [activeSidebarItem, setActiveSidebarItem] = useState('表格设置');
  const [zoom, setZoom] = useState(100);
  const [fontFamily, setFontFamily] = useState('Inter');
  const [fontSize, setFontSize] = useState('12');
  const [formulaValue, setFormulaValue] = useState('=SUM(C2:C10) * 1.15');
  const toast = (msg: string) => useToastStore.getState().addToast(msg, 'info');

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-bg-white-var">
      {/* Top header bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon name="table_chart" size={20} className="text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text-primary">2024 Q3 项目进度跟踪表</h3>
            <p className="text-[10px] text-success flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-success" />
              自动保存中...
            </p>
          </div>
        </div>

        {/* Menu items */}
        <div className="flex items-center gap-4">
          {MENU_ITEMS.map((item) => (
            <button key={item} type="button" onClick={() => useToastStore.getState().addToast(`${item}菜单开发中`, 'info')} className="text-xs text-text-secondary hover:text-text-primary">
              {item}
            </button>
          ))}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-3">
          {/* Collaborator avatars */}
          <div className="flex items-center -space-x-2">
            <div className="w-7 h-7 rounded-full bg-primary/20 border-2 border-white flex items-center justify-center text-[10px] font-bold text-primary">张</div>
            <div className="w-7 h-7 rounded-full bg-warning/20 border-2 border-white flex items-center justify-center text-[10px] font-bold text-warning">李</div>
            <span className="ml-2 text-xs text-text-muted">+3</span>
          </div>
          <button
            type="button"
            onClick={onExit}
            className="px-3 py-1.5 text-xs font-medium text-white bg-primary rounded-lg hover:bg-primary/90"
          >
            退出编辑
          </button>
          <button type="button" onClick={() => useToastStore.getState().addToast('链接已复制到剪贴板', 'success')} className="px-3 py-1.5 text-xs text-text-secondary border border-border rounded-lg hover:bg-bg-hover">
            分享
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-1 px-4 py-1.5 border-b border-border">
        <button type="button" onClick={() => toast('撤销功能即将上线')} className="p-1 text-text-muted hover:text-text-secondary"><Icon name="undo" size={16} /></button>
        <button type="button" onClick={() => toast('重做功能即将上线')} className="p-1 text-text-muted hover:text-text-secondary"><Icon name="redo" size={16} /></button>
        <button type="button" onClick={() => toast('打印功能即将上线')} className="p-1 text-text-muted hover:text-text-secondary"><Icon name="print" size={16} /></button>
        <div className="w-px h-5 bg-border mx-1" />
        {/* Font controls */}
        <select value={fontFamily} onChange={(e) => setFontFamily(e.target.value)} className="text-xs border border-border rounded px-2 py-1 bg-bg-white-var text-text-secondary">
          <option>Inter</option>
          <option>Arial</option>
          <option>Helvetica</option>
        </select>
        <select value={fontSize} onChange={(e) => setFontSize(e.target.value)} className="text-xs border border-border rounded px-2 py-1 bg-bg-white-var text-text-secondary w-14">
          <option>10</option>
          <option>12</option>
          <option>14</option>
          <option>16</option>
        </select>
        <div className="w-px h-5 bg-border mx-1" />
        <button type="button" onClick={() => toast('加粗功能即将上线')} className="p-1 text-text-secondary hover:bg-bg-hover rounded"><Icon name="format_bold" size={16} /></button>
        <button type="button" onClick={() => toast('斜体功能即将上线')} className="p-1 text-text-secondary hover:bg-bg-hover rounded"><Icon name="format_italic" size={16} /></button>
        <button type="button" onClick={() => toast('字体颜色功能即将上线')} className="p-1 text-text-secondary hover:bg-bg-hover rounded"><Icon name="format_color_text" size={16} /></button>
        <button type="button" onClick={() => toast('格式刷功能即将上线')} className="p-1 text-text-secondary hover:bg-bg-hover rounded"><Icon name="format_paint" size={16} /></button>
        <div className="w-px h-5 bg-border mx-1" />
        <button type="button" onClick={() => toast('网格功能即将上线')} className="p-1 text-text-secondary hover:bg-bg-hover rounded"><Icon name="grid_on" size={16} /></button>
        <button type="button" onClick={() => toast('左对齐功能即将上线')} className="p-1 text-text-secondary hover:bg-bg-hover rounded"><Icon name="format_align_left" size={16} /></button>
        <button type="button" onClick={() => toast('居中对齐功能即将上线')} className="p-1 text-text-secondary hover:bg-bg-hover rounded"><Icon name="format_align_center" size={16} /></button>
        <div className="w-px h-5 bg-border mx-1" />
        <button type="button" onClick={() => toast('筛选功能即将上线')} className="p-1 text-text-muted hover:text-text-secondary flex items-center gap-1 text-xs">
          <Icon name="filter_list" size={16} /> 筛选
        </button>
        <button type="button" onClick={() => toast('公式功能即将上线')} className="p-1 text-text-muted hover:text-text-secondary flex items-center gap-1 text-xs">
          <Icon name="functions" size={16} /> 公式
        </button>
      </div>

      {/* Formula bar */}
      <div className="flex items-center gap-2 px-4 py-1.5 border-b border-border bg-fill-tertiary/20">
        <span className="text-xs font-mono text-text-secondary w-8">{selectedCell}</span>
        <div className="w-px h-4 bg-border" />
        <Icon name="functions" size={14} className="text-text-muted" />
        <input
          type="text"
          value={formulaValue}
          onChange={(e) => setFormulaValue(e.target.value)}
          className="flex-1 text-xs font-mono bg-transparent focus:outline-none text-text-primary"
        />
        <button type="button" onClick={() => setShowAIFormula(!showAIFormula)} className="p-1 text-primary hover:bg-primary/10 rounded" title="AI 公式助手">
          <Icon name="auto_awesome" size={14} />
        </button>
      </div>
      {showAIFormula && (
        <div className="absolute right-4 top-24 z-50">
          <SpreadsheetAIFormula onApply={() => setShowAIFormula(false)} onDismiss={() => setShowAIFormula(false)} />
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* Left panel */}
        {showPanel && (
          <div className="w-56 border-r border-border flex flex-col bg-bg-white-var">
            <div className="px-4 py-3">
              <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider">工作表属性</h4>
              <p className="text-[10px] text-text-muted mt-0.5">正在编辑：年度预算总表</p>
            </div>

            <div className="px-4 space-y-1">
              {[
                { icon: 'settings', label: '表格设置' },
                { icon: 'grid_view', label: '单元格格式' },
                { icon: 'auto_awesome', label: '条件格式' },
                { icon: 'lock', label: '保护工作表' },
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => setActiveSidebarItem(item.label)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-colors ${
                    activeSidebarItem === item.label
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-text-secondary hover:bg-bg-hover'
                  }`}
                >
                  <Icon name={item.icon} size={16} />
                  {item.label}
                </button>
              ))}
            </div>

            {/* History */}
            <div className="px-4 mt-6">
              <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">历史记录</h4>
              <div className="space-y-3">
                {HISTORY.map((entry, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: entry.color }} />
                    <div>
                      <p className="text-xs text-text-primary">
                        <span className="font-medium">{entry.user}</span> {entry.action}
                      </p>
                      <p className="text-[10px] text-text-muted">{entry.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Spreadsheet grid */}
        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="w-10 py-2 bg-fill-tertiary/30 border-b border-r border-border text-xs text-text-muted font-medium" />
                {COLUMNS.map((col, _ci) => (
                  <th
                    key={col}
                    className={`px-4 py-2 bg-fill-tertiary/30 border-b border-r border-border text-xs font-medium min-w-[160px] ${
                      col === 'C' ? 'text-primary bg-primary/5' : 'text-text-muted'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{col}</span>
                    </div>
                  </th>
                ))}
              </tr>
              {/* Column header row */}
              <tr>
                <td className="w-10 py-2 bg-fill-tertiary/10 border-b border-r border-border text-center text-xs text-primary font-medium">1</td>
                {COL_HEADERS.map((header, i) => (
                  <td key={i} className="px-4 py-2 border-b border-r border-border text-xs font-semibold text-text-primary bg-fill-tertiary/10">
                    {i === 0 && <span className="inline-block w-4 h-4 rounded bg-primary/20 text-[8px] text-primary text-center leading-4 mr-1">Alice</span>}
                    {header}
                  </td>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row, ri) => (
                <tr key={ri}>
                  <td className="w-10 py-2.5 border-b border-r border-border text-center text-xs text-primary font-medium bg-fill-tertiary/10">
                    {ri + 2}
                  </td>
                  {row.map((cell, ci) => {
                    const cellId = `${COLUMNS[ci]}${ri + 2}`;
                    const isSelected = cellId === selectedCell;
                    return (
                      <td
                        key={ci}
                        onClick={() => setSelectedCell(cellId)}
                        className={`px-4 py-2.5 border-b border-r border-border text-sm cursor-pointer transition-colors ${
                          isSelected
                            ? 'ring-2 ring-primary ring-inset bg-primary/5'
                            : 'hover:bg-fill-tertiary/10'
                        } ${cell.style === 'currency' && cell.value.includes('820') ? 'text-error font-medium' : 'text-text-primary'}`}
                      >
                        {cell.style === 'progress' ? (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-fill-tertiary rounded-full overflow-hidden max-w-[80px]">
                              <div
                                className="h-full rounded-full"
                                style={{ width: `${cell.progressPercent}%`, backgroundColor: cell.progressColor }}
                              />
                            </div>
                            <span className="text-xs text-text-secondary">{cell.value}</span>
                          </div>
                        ) : cell.style === 'name-tag' && cell.tagColor ? (
                          <div className="flex items-center gap-1">
                            <span
                              className="px-1.5 py-0.5 rounded text-[10px] text-white font-medium"
                              style={{ backgroundColor: cell.tagColor }}
                            >
                              {cell.value.charAt(0)}
                            </span>
                            <span>{cell.value}</span>
                          </div>
                        ) : (
                          cell.value
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {/* Empty rows */}
              {Array.from({ length: 17 }, (_, i) => (
                <tr key={`empty-${i}`}>
                  <td className="w-10 py-2.5 border-b border-r border-border text-center text-xs text-primary font-medium bg-fill-tertiary/10">
                    {i + 5}
                  </td>
                  {COLUMNS.map((col) => (
                    <td key={col} className="px-4 py-2.5 border-b border-r border-border" />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom status bar */}
      <div className="flex items-center justify-between px-4 py-1.5 border-t border-border bg-fill-tertiary/20 text-[11px] text-text-muted">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowPanel(!showPanel)}
            className="flex items-center gap-1 hover:text-text-secondary"
          >
            <Icon name="view_sidebar" size={14} />
          </button>
          <span>工作表 1</span>
          <span className="flex items-center gap-1 text-success">
            <Icon name="check" size={12} /> 所有更改已保存在云端
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span>平均值: ¥ 2,200,000.00</span>
          <span>计数: 3</span>
          <span>求和: ¥ 6,600,000.00</span>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setZoom((z) => Math.max(25, z - 25))} className="p-0.5 hover:text-text-secondary"><Icon name="remove" size={12} /></button>
            <span>{zoom}%</span>
            <button type="button" onClick={() => setZoom((z) => Math.min(200, z + 25))} className="p-0.5 hover:text-text-secondary"><Icon name="add" size={12} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
