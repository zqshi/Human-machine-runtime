import { useState, useEffect, useCallback } from 'react';
import { cockpitStatisticsApi } from '../../../application/services/adminApi';
import { Icon } from '../../components/ui/Icon';

type Period = 'this-week' | 'last-week' | '7d' | '30d';

interface UserRow {
  userId: string;
  department: string;
  messages: number;
  tokens: number;
  estimatedCost: number;
}

type SortKey = 'messages' | 'tokens' | 'estimatedCost';

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getDateRange(period: Period): { startDate: string; endDate: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const thisMonday = getMonday(today);

  switch (period) {
    case 'this-week':
      return {
        startDate: thisMonday.toISOString().split('T')[0],
        endDate: today.toISOString().split('T')[0],
      };
    case 'last-week': {
      const lastMonday = new Date(thisMonday);
      lastMonday.setDate(lastMonday.getDate() - 7);
      const lastSunday = new Date(thisMonday);
      lastSunday.setDate(lastSunday.getDate() - 1);
      return {
        startDate: lastMonday.toISOString().split('T')[0],
        endDate: lastSunday.toISOString().split('T')[0],
      };
    }
    case '7d': {
      const start = new Date(today);
      start.setDate(start.getDate() - 6);
      return {
        startDate: start.toISOString().split('T')[0],
        endDate: today.toISOString().split('T')[0],
      };
    }
    case '30d': {
      const start = new Date(today);
      start.setDate(start.getDate() - 29);
      return {
        startDate: start.toISOString().split('T')[0],
        endDate: today.toISOString().split('T')[0],
      };
    }
  }
}

export function UserAnalysisSection() {
  const [period, setPeriod] = useState<Period>('this-week');
  const [department, setDepartment] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [departments, setDepartments] = useState<string[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [messageTrend, setMessageTrend] = useState<{ days: string[]; values: number[] }>({
    days: [],
    values: [],
  });
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('messages');
  const [sortAsc, setSortAsc] = useState(false);

  const fetchData = useCallback(() => {
    setLoading(true);
    const range = getDateRange(period);
    const params = {
      ...range,
      department: department || undefined,
      userId: userSearch || undefined,
      limit: 50,
    };

    Promise.all([
      cockpitStatisticsApi.userAnalysis(params),
      cockpitStatisticsApi.messages({ startDate: range.startDate, endDate: range.endDate }),
    ])
      .then(([analysis, msgs]) => {
        setUsers(analysis.users || []);
        setDepartments(analysis.departments || []);
        setMessageTrend(msgs);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [period, department, userSearch]);

  useEffect(fetchData, [fetchData]);

  const sorted = [...users].sort((a, b) => {
    const diff = a[sortKey] - b[sortKey];
    return sortAsc ? diff : -diff;
  });

  const totalUsers = new Set(users.map((u) => u.userId)).size;
  const totalMessages = users.reduce((s, u) => s + u.messages, 0);
  const totalTokens = users.reduce((s, u) => s + u.tokens, 0);
  const totalCost = users.reduce((s, u) => s + u.estimatedCost, 0);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const deptDistribution = (() => {
    const map = new Map<string, number>();
    for (const u of users) {
      map.set(u.department, (map.get(u.department) || 0) + u.messages);
    }
    return [...map.entries()]
      .map(([name, messages]) => ({ name, messages }))
      .sort((a, b) => b.messages - a.messages);
  })();
  const maxDeptMsg = Math.max(...deptDistribution.map((d) => d.messages), 1);

  const maxTrendVal = Math.max(...messageTrend.values, 1);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-800">用户分析</h1>
          <p className="text-xs text-gray-400 mt-0.5">按日期、部门、成员维度分析消息使用情况</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1">
          {(
            [
              ['this-week', '本周'],
              ['last-week', '上周'],
              ['7d', '近7天'],
              ['30d', '近30天'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setPeriod(key)}
              className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                period === key
                  ? 'bg-[#007AFF] text-white'
                  : 'border border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <select
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20"
        >
          <option value="">全部部门</option>
          {departments.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="搜索用户..."
          value={userSearch}
          onChange={(e) => setUserSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && fetchData()}
          className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 w-40"
        />
        {userSearch && (
          <button
            onClick={() => setUserSearch('')}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            清除
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-gray-400 text-sm text-center py-12">加载中...</div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-3">
            <SummaryCard icon="group" label="活跃用户" value={totalUsers} color="#007AFF" />
            <SummaryCard
              icon="chat_bubble"
              label="总消息"
              value={totalMessages.toLocaleString()}
              color="#AF52DE"
            />
            <SummaryCard
              icon="token"
              label="总 Token"
              value={formatTokens(totalTokens)}
              color="#FF9500"
            />
            <SummaryCard
              icon="payments"
              label="总花费"
              value={`¥${totalCost.toFixed(2)}`}
              color="#34C759"
            />
          </div>

          {/* Message Trend Chart */}
          <div className="border border-gray-200 rounded-xl p-5 bg-white">
            <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-1.5">
              <Icon name="show_chart" size={16} className="text-gray-400" />
              消息趋势
            </h3>
            <div className="flex items-end gap-1 h-24">
              {messageTrend.days.map((day, i) => {
                const h = (messageTrend.values[i] / maxTrendVal) * 100;
                return (
                  <div key={day} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full rounded-t transition-all bg-[#007AFF]/70 hover:bg-[#007AFF] min-h-[2px]"
                      style={{ height: `${Math.max(h, 2)}%` }}
                      title={`${day}: ${messageTrend.values[i]} 消息`}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex gap-1 mt-1">
              {messageTrend.days.map((day) => (
                <div key={day} className="flex-1 text-center text-[9px] text-gray-400 truncate">
                  {day.slice(5)}
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {/* User Table */}
            <div className="col-span-2 border border-gray-200 rounded-xl p-5 bg-white">
              <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-1.5">
                <Icon name="table_chart" size={16} className="text-gray-400" />
                用户活动明细
                <span className="text-xs text-gray-400 ml-auto">{users.length} 条记录</span>
              </h3>
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2 px-2 text-gray-400 font-medium">用户</th>
                      <th className="text-left py-2 px-2 text-gray-400 font-medium">部门</th>
                      <SortHeader
                        label="消息"
                        active={sortKey === 'messages'}
                        asc={sortAsc}
                        onClick={() => handleSort('messages')}
                      />
                      <SortHeader
                        label="Token"
                        active={sortKey === 'tokens'}
                        asc={sortAsc}
                        onClick={() => handleSort('tokens')}
                      />
                      <SortHeader
                        label="花费 (¥)"
                        active={sortKey === 'estimatedCost'}
                        asc={sortAsc}
                        onClick={() => handleSort('estimatedCost')}
                      />
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-8 text-gray-400">
                          暂无数据
                        </td>
                      </tr>
                    ) : (
                      sorted.map((row, i) => (
                        <tr
                          key={`${row.userId}-${i}`}
                          className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                        >
                          <td className="py-2 px-2 text-gray-700 font-medium truncate max-w-[120px]">
                            {row.userId}
                          </td>
                          <td className="py-2 px-2 text-gray-500 truncate max-w-[80px]">
                            {row.department}
                          </td>
                          <td className="py-2 px-2 text-right text-gray-600 tabular-nums">
                            {row.messages.toLocaleString()}
                          </td>
                          <td className="py-2 px-2 text-right text-gray-600 tabular-nums">
                            {formatTokens(row.tokens)}
                          </td>
                          <td className="py-2 px-2 text-right text-gray-600 tabular-nums">
                            {row.estimatedCost.toFixed(2)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Department Distribution */}
            <div className="border border-gray-200 rounded-xl p-5 bg-white">
              <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-1.5">
                <Icon name="corporate_fare" size={16} className="text-gray-400" />
                部门消息分布
              </h3>
              <div className="space-y-2.5">
                {deptDistribution.length === 0 ? (
                  <div className="text-xs text-gray-400 text-center py-8">暂无数据</div>
                ) : (
                  deptDistribution.map((d) => (
                    <div key={d.name} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-600 truncate max-w-[120px]">{d.name}</span>
                        <span className="text-gray-500 tabular-nums">
                          {d.messages.toLocaleString()}
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#5856D6]"
                          style={{ width: `${(d.messages / maxDeptMsg) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  color,
}: {
  icon: string;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="border border-gray-200 rounded-xl p-4 bg-white">
      <div className="flex items-center gap-2 mb-1">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: `${color}12` }}
        >
          <Icon name={icon} size={16} style={{ color }} />
        </div>
      </div>
      <div className="text-[11px] text-gray-400">{label}</div>
      <div className="text-xl font-bold text-gray-800 tabular-nums">{value}</div>
    </div>
  );
}

function SortHeader({
  label,
  active,
  asc,
  onClick,
}: {
  label: string;
  active: boolean;
  asc: boolean;
  onClick: () => void;
}) {
  return (
    <th
      className="text-right py-2 px-2 text-gray-400 font-medium cursor-pointer hover:text-gray-600 select-none"
      onClick={onClick}
    >
      {label}
      {active && <span className="ml-0.5">{asc ? '↑' : '↓'}</span>}
    </th>
  );
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}
