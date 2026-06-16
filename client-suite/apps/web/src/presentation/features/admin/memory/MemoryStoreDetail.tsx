import { useState, useEffect, useCallback } from 'react';
import {
  employeeMemoryApi,
  type MemoryStore,
} from '../../../../application/services/adminApi';
import { useToastStore } from '../../../../application/stores/toastStore';
import { Icon } from '../../../components/ui/Icon';
import { MemoryFragmentList } from './MemoryFragmentList';
import { MemoryRuleEditor } from './MemoryRuleEditor';
import { MemorySearchVerify } from './MemorySearchVerify';

type Tab = 'personal' | 'shared' | 'rules' | 'search';

interface Props {
  storeId: string;
  onBack: () => void;
}

export function MemoryStoreDetail({ storeId, onBack }: Props) {
  const [store, setStore] = useState<MemoryStore | null>(null);
  const [tab, setTab] = useState<Tab>('personal');
  const [loading, setLoading] = useState(true);

  const loadStore = useCallback(async () => {
    try {
      const s = await employeeMemoryApi.getStore(storeId);
      setStore(s);
    } catch {
      useToastStore.getState().addToast('加载记忆库失败', 'error');
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => { loadStore(); }, [loadStore]);

  const TABS: { key: Tab; label: string; icon: string; desc: string }[] = [
    { key: 'personal', label: '个人记忆', icon: 'person', desc: '各用户的个性化记忆' },
    { key: 'shared', label: '共享记忆', icon: 'groups', desc: '从个人记忆提取的脱敏共识' },
    { key: 'rules', label: '记忆规则', icon: 'rule', desc: '自动提取与画像规则' },
    { key: 'search', label: '检索验证', icon: 'search', desc: '测试记忆检索效果' },
  ];

  if (loading) {
    return <div className="p-6 flex items-center justify-center h-40 text-gray-400 text-sm">加载中...</div>;
  }

  if (!store) {
    return (
      <div className="p-6 text-center text-gray-400">
        <p>记忆库不存在或已删除</p>
        <button onClick={onBack} className="mt-2 text-xs text-[#007AFF] hover:underline">返回列表</button>
      </div>
    );
  }

  const orgCount = store.orgFragmentCount ?? 0;
  const personalCount = store.personalFragmentCount ?? 0;

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <button
          onClick={onBack}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
        >
          <Icon name="arrow_back" size={20} />
        </button>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-gray-800">{store.name}</h2>
          <p className="text-xs text-gray-400 mt-0.5 font-mono">{store.id}</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700">{personalCount} 条个人记忆</span>
          <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">{orgCount} 条共享记忆</span>
          {store.totalProfiles > 0 && (
            <>
              <span>·</span>
              <span>覆盖 {store.totalProfiles} 个用户</span>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-100 rounded-lg p-0.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs rounded-md transition-colors ${
              tab === t.key
                ? 'bg-white text-[#007AFF] font-medium shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon name={t.icon} size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab description */}
      <p className="text-xs text-gray-400">
        {TABS.find((t) => t.key === tab)?.desc}
      </p>

      {/* Tab Content */}
      {tab === 'personal' && (
        <MemoryFragmentList store={store} scope="personal" onStoreChange={loadStore} />
      )}
      {tab === 'shared' && (
        <MemoryFragmentList store={store} scope="org" onStoreChange={loadStore} />
      )}
      {tab === 'rules' && <MemoryRuleEditor store={store} />}
      {tab === 'search' && <MemorySearchVerify store={store} onStoreChange={loadStore} />}
    </div>
  );
}
