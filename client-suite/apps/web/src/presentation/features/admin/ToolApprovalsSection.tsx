/**
 * ToolApprovalsSection — 工具执行审批队列(#7 Human Review,T4)。
 *
 * 列出 pending 审批,admin approve(触发续执行)/reject。消费 toolApprovalsApi。
 */
import { useState, useEffect, useCallback } from 'react';
import { toolApprovalsApi, type ToolApproval } from '../../../infrastructure/api/v19AdminApi';
import { useToastStore } from '../../../application/stores/toastStore';

const RISK_COLORS: Record<string, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-green-100 text-green-700',
};

export function ToolApprovalsSection() {
  const [items, setItems] = useState<ToolApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const toast = useToastStore((s) => s.addToast);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await toolApprovalsApi.listPending();
      setItems(r.items);
    } catch (e) {
      toast(`加载审批队列失败: ${(e as Error).message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const approve = async (id: string) => {
    setActing(id);
    try {
      await toolApprovalsApi.approve(id);
      toast('已批准,工具继续执行', 'success');
      await refresh();
    } catch (e) {
      toast(`批准失败: ${(e as Error).message}`, 'error');
    } finally {
      setActing(null);
    }
  };

  const reject = async (id: string) => {
    setActing(id);
    try {
      await toolApprovalsApi.reject(id);
      toast('已拒绝', 'success');
      await refresh();
    } catch (e) {
      toast(`拒绝失败: ${(e as Error).message}`, 'error');
    } finally {
      setActing(null);
    }
  };

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">工具执行审批</h2>
          <p className="text-[12px] text-gray-500 mt-0.5">
            高风险工具调用按 riskLevel 走审批队列,approve 触发续执行
          </p>
        </div>
        <button
          onClick={refresh}
          className="px-3 py-1.5 text-[12px] rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors"
        >
          刷新
        </button>
      </div>

      {loading ? (
        <p className="text-[13px] text-gray-400">加载中...</p>
      ) : items.length === 0 ? (
        <div className="p-8 text-center text-[13px] text-gray-400 border border-dashed border-gray-200 rounded-xl">
          暂无待审批项
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((a) => (
            <div key={a.id} className="p-3 border border-gray-200 rounded-xl bg-white">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[13px] font-medium text-gray-800">{a.toolName}</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${RISK_COLORS[a.riskLevel] ?? RISK_COLORS.medium}`}
                >
                  {a.riskLevel}
                </span>
                <span className="text-[11px] text-gray-400">·</span>
                <span className="text-[11px] text-gray-500">{a.toolId}</span>
                {a.instanceId && (
                  <span className="text-[11px] text-gray-400">实例 {a.instanceId}</span>
                )}
              </div>
              <div className="text-[11px] text-gray-500 mb-2">
                参数:{' '}
                <code className="text-[11px] bg-gray-50 px-1 py-0.5 rounded">
                  {JSON.stringify(a.params).slice(0, 120)}
                </code>
              </div>
              <div className="text-[11px] text-gray-400 mb-3">
                请求人 {a.requestedBy ?? '-'} · {new Date(a.createdAt).toLocaleString()}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => approve(a.id)}
                  disabled={acting === a.id}
                  className="px-3 py-1.5 text-[12px] rounded-lg bg-[#007AFF] text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  批准执行
                </button>
                <button
                  onClick={() => reject(a.id)}
                  disabled={acting === a.id}
                  className="px-3 py-1.5 text-[12px] rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-50 transition-colors"
                >
                  拒绝
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
