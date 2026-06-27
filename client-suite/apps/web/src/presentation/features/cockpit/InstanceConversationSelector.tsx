import { useState, useEffect } from 'react';
import { instanceApi } from '../../../application/services/adminApi';
import { useCockpitStore } from '../../../application/stores/cockpitStore';
import { Icon } from '../../components/ui/Icon';

interface InstanceOption {
  id: string;
  name: string;
  department?: string;
  state?: string;
}

/**
 * Cockpit 对话对象选择器：选择当前对话绑定哪个数字员工实例。
 *
 * 选定后 activeInstanceId 写入 cockpitStore，聊天请求会携带该 id，
 * 后端 chat.ts 据此做模型授权白名单校验。
 * 未选（「平台助手」）= 统一助手，不受 instance 授权约束。
 */
export function InstanceConversationSelector() {
  const activeInstanceId = useCockpitStore((s) => s.activeInstanceId);
  const setActiveInstanceId = useCockpitStore((s) => s.setActiveInstanceId);
  const [instances, setInstances] = useState<InstanceOption[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    instanceApi
      .list()
      .then((r) => {
        const list = (r.instances || []) as Record<string, unknown>[];
        setInstances(
          list.map((i) => ({
            id: String(i.id),
            name: String(i.name || i.displayName || i.id),
            department: i.department ? String(i.department) : undefined,
            state: i.state ? String(i.state) : undefined,
          }))
        );
      })
      .catch(() => setInstances([]));
  }, []);

  const active = instances.find((i) => i.id === activeInstanceId) || null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-600"
        title="选择对话的数字员工（决定可用模型范围）"
      >
        <Icon name={active ? 'smart_toy' : 'psychology'} size={13} className="text-[#007AFF]" />
        <span className="font-medium">{active ? active.name : '平台助手'}</span>
        {active && (
          <span
            className={`px-1 py-px rounded text-[9px] ${
              active.state === 'running'
                ? 'bg-green-50 text-green-600'
                : 'bg-gray-100 text-gray-500'
            }`}
          >
            {active.state === 'running' ? '运行' : '停用'}
          </span>
        )}
        <Icon name="expand_more" size={14} className="text-gray-400" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-40 w-64 max-h-72 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg py-1">
            <button
              onClick={() => {
                setActiveInstanceId(null);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${
                !activeInstanceId ? 'text-[#007AFF] bg-[#007AFF]/5' : 'text-gray-700'
              }`}
            >
              <Icon name="psychology" size={14} />
              <div className="flex-1">
                <div className="font-medium">平台助手</div>
                <div className="text-[11px] text-gray-400">统一助手 · 不受模型授权约束</div>
              </div>
            </button>
            {instances.length > 0 && (
              <div className="px-3 py-1 text-[10px] text-gray-400 uppercase tracking-wider border-t border-gray-100 mt-1">
                数字员工
              </div>
            )}
            {instances.map((inst) => (
              <button
                key={inst.id}
                onClick={() => {
                  setActiveInstanceId(inst.id);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${
                  inst.id === activeInstanceId ? 'text-[#007AFF] bg-[#007AFF]/5' : 'text-gray-700'
                }`}
              >
                <Icon name="smart_toy" size={14} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{inst.name}</div>
                  <div className="text-[11px] text-gray-400 truncate">
                    {inst.department || '未分组'}
                  </div>
                </div>
                <span
                  className={`shrink-0 w-1.5 h-1.5 rounded-full ${
                    inst.state === 'running' ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                />
              </button>
            ))}
            {instances.length === 0 && (
              <div className="px-3 py-3 text-center text-xs text-gray-400">暂无数字员工</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
