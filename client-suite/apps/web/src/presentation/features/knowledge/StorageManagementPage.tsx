/**
 * StorageManagementPage — 容量管理综合工作台 (km_16 对齐)
 * 存储利用率环形图 + 容量卡片 + 部门占比柱状图 + 增长趋势 + 大文件排行表
 *
 * 数据来源：knowledgeStore (storageStats, deptStorage, largeFiles)
 */
import { useState, useEffect } from 'react';
import { Icon } from '../../components/ui/Icon';
import { Avatar } from '../../components/ui/Avatar';
import { useToastStore } from '../../../application/stores/toastStore';
import { useKnowledgeStore } from '../../../application/stores/knowledgeStore';

interface StorageManagementPageProps {
  onClose?: () => void;
}

export function StorageManagementPage({ onClose }: StorageManagementPageProps) {
  const [fileFilter, setFileFilter] = useState<'all' | 'unused'>('all');
  const [fileSearch, setFileSearch] = useState('');

  const storageStats = useKnowledgeStore((s) => s.storageStats);
  const deptStorage = useKnowledgeStore((s) => s.deptStorage);
  const largeFiles = useKnowledgeStore((s) => s.largeFiles);
  const fetchStorageStats = useKnowledgeStore((s) => s.fetchStorageStats);
  const fetchDeptStorage = useKnowledgeStore((s) => s.fetchDeptStorage);
  const fetchLargeFiles = useKnowledgeStore((s) => s.fetchLargeFiles);

  useEffect(() => {
    fetchStorageStats();
    fetchDeptStorage();
    fetchLargeFiles();
  }, [fetchStorageStats, fetchDeptStorage, fetchLargeFiles]);

  const filteredFiles = largeFiles.filter((f) => {
    if (
      fileSearch &&
      !f.name.includes(fileSearch) &&
      !f.owner.includes(fileSearch) &&
      !f.departmentName.includes(fileSearch)
    )
      return false;
    return true;
  });

  const usedPercent = storageStats?.usedPercent ?? 75;
  const totalGB = storageStats?.totalGB ?? 500;
  const usedGB = storageStats?.usedGB ?? 375;
  const freeGB = totalGB - usedGB;

  return (
    <div className="flex-1 overflow-y-auto">
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary mb-3 px-6 pt-3"
        >
          <Icon name="arrow_back" size={18} /> 返回
        </button>
      )}
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-3 bg-bg-white-var/80 backdrop-blur-sm border-b border-border">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-text-primary">容量管理综合工作台</h2>
          {usedPercent >= 75 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-warning/10">
              <Icon name="warning" size={14} className="text-warning" />
              <span className="text-[11px] font-medium text-warning">
                当前使用率达到 {usedPercent}% 警戒值
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => useToastStore.getState().addToast('报告导出功能开发中', 'info')}
            className="px-3 py-1.5 text-xs font-medium text-text-secondary border border-border rounded-lg hover:bg-bg-hover"
          >
            报告导出
          </button>
          <button
            type="button"
            onClick={() => useToastStore.getState().addToast('扩容申请功能开发中', 'info')}
            className="px-3 py-1.5 text-xs font-medium text-white bg-primary rounded-lg hover:bg-primary/90 flex items-center gap-1.5"
          >
            <Icon name="expand_less" size={14} /> 申请扩容
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6 max-w-6xl">
        {/* Top stats row */}
        <div className="grid grid-cols-4 gap-4">
          {/* Usage ring */}
          <div className="bg-bg-white-var rounded-2xl border border-border p-5 flex flex-col items-center">
            <p className="text-xs text-text-muted mb-3">当前存储利用率</p>
            <div className="relative w-28 h-28">
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#E5E5EA"
                  strokeWidth="3"
                />
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#007AFF"
                  strokeWidth="3"
                  strokeDasharray={`${usedPercent}, 100`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-text-primary">{usedPercent}%</span>
                <span className="text-[10px] text-text-muted">已使用</span>
              </div>
            </div>
            <p className="text-[10px] text-text-muted mt-2">
              健康状态：
              <span className={usedPercent >= 75 ? 'text-warning' : 'text-success'}>
                {usedPercent >= 75 ? '一般' : '良好'}
              </span>
            </p>
          </div>

          {/* Total */}
          <StatCard
            icon="cloud"
            iconColor="#007AFF"
            badge="TOTAL"
            label="总容量"
            value={totalGB >= 1000 ? (totalGB / 1000).toFixed(2) : String(totalGB)}
            unit={totalGB >= 1000 ? 'TB' : 'GB'}
          />
          {/* Used */}
          <StatCard
            icon="donut_large"
            iconColor="#FF9500"
            badge="USED"
            label="已用空间"
            value={usedGB >= 1000 ? (usedGB / 1000).toFixed(2) : String(usedGB)}
            unit={usedGB >= 1000 ? 'TB' : 'GB'}
            sub={storageStats ? `30天增长 ${storageStats.trend30d}%` : undefined}
            subColor="#34C759"
          />
          {/* Free */}
          <StatCard
            icon="check_circle"
            iconColor="#34C759"
            badge="FREE"
            label="可用空间"
            value={String(freeGB)}
            unit="GB"
            sub={`${storageStats?.fileCount?.toLocaleString() ?? '-'} 个文件`}
          />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-2 gap-4">
          {/* Dept storage breakdown */}
          <div className="bg-bg-white-var rounded-2xl border border-border p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Icon name="bar_chart" size={16} className="text-primary" />
                <h3 className="text-sm font-semibold text-text-primary">部门存储占比</h3>
              </div>
              <button
                type="button"
                onClick={() => useToastStore.getState().addToast('详情展开功能开发中', 'info')}
                className="p-1 text-text-muted hover:text-primary"
              >
                <Icon name="open_in_new" size={14} />
              </button>
            </div>
            <div className="space-y-4">
              {deptStorage.map((dept) => {
                const totalUsed = deptStorage.reduce((s, d) => s + d.usedGB, 0);
                const percent = totalUsed > 0 ? Math.round((dept.usedGB / totalUsed) * 100) : 0;
                return (
                  <div key={dept.departmentId}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-text-secondary">{dept.departmentName}</span>
                      <span className="text-xs font-medium text-text-primary">
                        {dept.usedGB} GB ({percent}%)
                      </span>
                    </div>
                    <div className="h-2 bg-fill-tertiary rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${percent}%`, backgroundColor: dept.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Growth trend */}
          <div className="bg-bg-white-var rounded-2xl border border-border p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Icon name="trending_up" size={16} className="text-primary" />
                <h3 className="text-sm font-semibold text-text-primary">存储增长趋势 (30天)</h3>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-primary" />
                <span className="text-[10px] text-text-muted">预测增长</span>
              </div>
            </div>
            <div className="flex items-end gap-2 h-40">
              {[30, 35, 40, 38, 45, 50, 55, 60, 65, 72, 78, 85].map((h, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className={`w-full rounded-t-sm ${i >= 10 ? 'bg-primary/30 border border-dashed border-primary' : 'bg-primary'}`}
                    style={{ height: `${h}%` }}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-2">
              <span className="text-[9px] text-text-muted">30天前</span>
              <span className="text-[9px] text-text-muted">15天前</span>
              <span className="text-[9px] text-text-muted">今天</span>
              <span className="text-[9px] text-primary font-medium">预测</span>
            </div>
          </div>
        </div>

        {/* Large files table */}
        <div className="bg-bg-white-var rounded-2xl border border-border">
          <div className="flex items-center justify-between p-5 pb-3">
            <div className="flex items-center gap-2">
              <Icon name="lens" size={14} className="text-primary" />
              <h3 className="text-sm font-semibold text-text-primary">大文件排行</h3>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Icon
                  name="search"
                  size={14}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted"
                />
                <input
                  type="text"
                  value={fileSearch}
                  onChange={(e) => setFileSearch(e.target.value)}
                  placeholder="搜索文件名..."
                  className="pl-8 pr-3 py-1.5 text-xs border border-border rounded-lg bg-bg-white-var w-40 focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="flex rounded-lg border border-border overflow-hidden">
                <button
                  type="button"
                  onClick={() => setFileFilter('all')}
                  className={`px-3 py-1.5 text-[11px] font-medium ${fileFilter === 'all' ? 'bg-primary text-white' : 'text-text-secondary hover:bg-bg-hover'}`}
                >
                  所有文件
                </button>
                <button
                  type="button"
                  onClick={() => setFileFilter('unused')}
                  className={`px-3 py-1.5 text-[11px] font-medium ${fileFilter === 'unused' ? 'bg-primary text-white' : 'text-text-secondary hover:bg-bg-hover'}`}
                >
                  长期未用
                </button>
              </div>
            </div>
          </div>

          <table className="w-full">
            <thead>
              <tr className="bg-fill-tertiary/30 text-left">
                <th className="px-5 py-2.5 text-[11px] font-medium text-text-muted">文件名</th>
                <th className="px-4 py-2.5 text-[11px] font-medium text-text-muted">所有者</th>
                <th className="px-4 py-2.5 text-[11px] font-medium text-text-muted">占用大小</th>
                <th className="px-4 py-2.5 text-[11px] font-medium text-text-muted">部门</th>
                <th className="px-4 py-2.5 text-[11px] font-medium text-text-muted text-right">
                  操作
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredFiles.map((file) => (
                <tr
                  key={file.id}
                  className="border-t border-border/50 hover:bg-bg-hover/30 transition-colors"
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <Icon name="insert_drive_file" size={18} className="text-primary" />
                      <span className="text-xs font-medium text-text-primary">{file.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar letter={file.owner.charAt(0)} size={24} />
                      <span className="text-xs text-text-primary">{file.owner}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-semibold text-text-primary">
                      {file.sizeMB >= 1024
                        ? `${(file.sizeMB / 1024).toFixed(1)} GB`
                        : `${file.sizeMB} MB`}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[11px] text-text-secondary">{file.departmentName}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() =>
                        useToastStore.getState().addToast('文件操作菜单开发中', 'info')
                      }
                      className="p-1 text-text-muted hover:text-text-secondary"
                    >
                      <Icon name="more_horiz" size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  iconColor,
  badge,
  label,
  value,
  unit,
  sub,
  subColor,
}: {
  icon: string;
  iconColor: string;
  badge: string;
  label: string;
  value: string;
  unit: string;
  sub?: string;
  subColor?: string;
}) {
  return (
    <div className="bg-bg-white-var rounded-2xl border border-border p-5 transition-all duration-200 hover:shadow-md hover:border-gray-300 hover:-translate-y-0.5 cursor-default">
      <div className="flex items-center justify-between mb-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-transform duration-200 hover:scale-105"
          style={{ backgroundColor: iconColor + '14' }}
        >
          <Icon name={icon} size={20} style={{ color: iconColor }} />
        </div>
        <span className="text-[10px] font-bold text-text-muted tracking-wider">{badge}</span>
      </div>
      <p className="text-xs text-text-muted mb-0.5">{label}</p>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold text-text-primary">{value}</span>
        <span className="text-sm text-text-muted">{unit}</span>
      </div>
      {sub && (
        <p
          className={`text-[10px] mt-1.5 ${subColor ? '' : 'text-text-secondary'}`}
          style={subColor ? { color: subColor } : undefined}
        >
          {sub}
        </p>
      )}
    </div>
  );
}
