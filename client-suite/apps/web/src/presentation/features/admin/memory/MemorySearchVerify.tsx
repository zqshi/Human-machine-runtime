import { useState } from 'react';
import {
  employeeMemoryApi,
  type MemoryStore,
  type MemorySearchHit,
} from '../../../../application/services/adminApi';
import { useToastStore } from '../../../../application/stores/toastStore';
import { Icon } from '../../../components/ui/Icon';

interface Props {
  store: MemoryStore;
  onStoreChange: () => void;
}

const TYPE_MAP: Record<string, { label: string; cls: string }> = {
  preference: { label: '画像', cls: 'bg-amber-50 text-amber-700' },
  fact: { label: '规则', cls: 'bg-blue-50 text-blue-700' },
};

function hitTypeOf(v: string) {
  return TYPE_MAP[v] ?? { label: v, cls: 'bg-gray-50 text-gray-700' };
}

const sCls = 'px-2 py-1 text-xs border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-[#007AFF]/30 focus:border-[#007AFF]';

export function MemorySearchVerify({ store, onStoreChange }: Props) {
  const [config, setConfig] = useState(store.retrievalConfig);
  const [configSaving, setConfigSaving] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);

  const [testQuery, setTestQuery] = useState('');
  const [testUserId, setTestUserId] = useState('');
  const [userScopeOpen, setUserScopeOpen] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [testResults, setTestResults] = useState<MemorySearchHit[]>([]);
  const [testChannels, setTestChannels] = useState<{ keyword: boolean; vector: boolean }>({ keyword: false, vector: false });

  const handleSaveConfig = async () => {
    setConfigSaving(true);
    try {
      await employeeMemoryApi.updateRetrievalConfig(store.id, config);
      useToastStore.getState().addToast('检索配置已保存', 'success');
      onStoreChange();
    } catch (err) {
      useToastStore.getState().addToast(`保存失败：${err instanceof Error ? err.message : '未知'}`, 'error');
    } finally {
      setConfigSaving(false);
    }
  };

  const handleVerify = async () => {
    if (!testQuery.trim()) {
      useToastStore.getState().addToast('请输入查询内容', 'info');
      return;
    }
    setTestLoading(true);
    try {
      const result = await employeeMemoryApi.verify(store.id, testQuery.trim(), {
        userId: testUserId.trim() || undefined,
      });
      setTestResults(result.hits);
      setTestChannels(result.channels);
    } catch (err) {
      useToastStore.getState().addToast(`验证失败：${err instanceof Error ? err.message : '未知'}`, 'error');
      setTestResults([]);
    } finally {
      setTestLoading(false);
    }
  };

  const effectiveScope = testUserId.trim() ? `仅 ${testUserId.trim()}` : '全量';

  return (
    <div className="space-y-3">
      {/* ─── Config: collapsible ─── */}
      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <button
          onClick={() => setConfigOpen(!configOpen)}
          className="w-full flex items-center gap-2 px-3 py-2 bg-gray-50/60 text-xs font-medium text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <Icon name="tune" size={14} className="text-gray-400" />
          <span className="flex-1 text-left">检索配置</span>
          <span className="text-[10px] text-gray-400">
            {config.useKeywordSearch && config.useVectorSearch ? '混合' : config.useVectorSearch ? '向量' : '关键词'} · Top{config.topK}
          </span>
          <Icon name={configOpen ? 'expand_less' : 'expand_more'} size={14} className="text-gray-400" />
        </button>
        {configOpen && (
          <div className="p-3 space-y-3 bg-white">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-[11px]">
                <input type="checkbox" checked={config.useKeywordSearch} onChange={(e) => setConfig({ ...config, useKeywordSearch: e.target.checked })} className="rounded border-gray-300" />
                <span className="text-gray-700">关键词</span>
              </label>
              <label className="flex items-center gap-1.5 text-[11px]">
                <input type="checkbox" checked={config.useVectorSearch} onChange={(e) => setConfig({ ...config, useVectorSearch: e.target.checked })} className="rounded border-gray-300" />
                <span className="text-gray-700">向量</span>
              </label>
            </div>
            <div className="grid grid-cols-5 gap-2">
              <div>
                <label className="block text-[10px] text-gray-500 mb-0.5">Top K</label>
                <input type="number" min={1} max={50} value={config.topK} onChange={(e) => setConfig({ ...config, topK: Number(e.target.value) })} className={sCls} />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-0.5">阈值</label>
                <input type="number" min={0} max={1} step={0.05} value={config.scoreThreshold} onChange={(e) => setConfig({ ...config, scoreThreshold: Number(e.target.value) })} className={sCls} />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-0.5">词权重</label>
                <input type="number" min={0} max={1} step={0.1} value={config.keywordWeight} onChange={(e) => setConfig({ ...config, keywordWeight: Number(e.target.value) })} className={sCls} />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-0.5">向权重</label>
                <input type="number" min={0} max={1} step={0.1} value={config.vectorWeight} onChange={(e) => setConfig({ ...config, vectorWeight: Number(e.target.value) })} className={sCls} />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-0.5">时效/天</label>
                <input type="number" min={0} value={config.maxMemoryAge} onChange={(e) => setConfig({ ...config, maxMemoryAge: Number(e.target.value) })} className={sCls} />
              </div>
            </div>
            <div className="flex justify-end">
              <button onClick={handleSaveConfig} disabled={configSaving} className="px-3 py-1 text-[11px] font-medium text-white bg-[#007AFF] rounded-md hover:bg-[#0066DD] disabled:opacity-50">
                {configSaving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Query bar: single input + scope toggle + search button ─── */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Icon name="search" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text" value={testQuery} onChange={(e) => setTestQuery(e.target.value)}
              placeholder="输入查询内容，验证检索效果"
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF]"
              onKeyDown={(e) => { if (e.key === 'Enter') handleVerify(); }}
            />
          </div>
          <button
            onClick={() => setUserScopeOpen(!userScopeOpen)}
            className={`px-2.5 py-1.5 text-[11px] rounded-lg border transition-colors flex items-center gap-1 ${
              testUserId.trim()
                ? 'border-[#007AFF]/30 bg-[#007AFF]/5 text-[#007AFF]'
                : 'border-gray-200 text-gray-500 hover:border-gray-300'
            }`}
            title="限定检索范围到特定用户"
          >
            <Icon name="person" size={12} />
            {testUserId.trim() ? testUserId.trim() : '全量'}
          </button>
          <button
            onClick={handleVerify} disabled={testLoading}
            className="px-4 py-2 text-sm font-medium text-white bg-[#007AFF] rounded-lg hover:bg-[#0066DD] disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap"
          >
            {testLoading ? (
              <><span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />检索中</>
            ) : (
              <Icon name="search" size={14} />
            )}
          </button>
        </div>

        {/* User scope: expandable inline */}
        {userScopeOpen && (
          <div className="flex items-center gap-2 pl-1">
            <span className="text-[11px] text-gray-500">限定用户</span>
            <input
              type="text" value={testUserId} onChange={(e) => setTestUserId(e.target.value)}
              placeholder="输入用户ID，留空则全量检索"
              className={`${sCls} w-48`}
            />
            <span className="text-[10px] text-gray-400">当前：{effectiveScope}</span>
          </div>
        )}
      </div>

      {/* Channel indicators */}
      {(testResults.length > 0 || testLoading) && (
        <div className="flex items-center gap-2 text-[10px] text-gray-500">
          <span>通道：</span>
          {testChannels.keyword && <span className="px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700">关键词</span>}
          {testChannels.vector && <span className="px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-700">向量</span>}
          <span>· 命中 {testResults.length} 条</span>
        </div>
      )}

      {/* Results */}
      {testResults.length > 0 && (
        <div className="space-y-1.5">
          {testResults.map((hit, i) => {
            const ht = hitTypeOf(hit.type);
            return (
              <div key={hit.fragmentId} className="group px-3 py-2 rounded-lg border border-gray-100 bg-white hover:border-gray-200 transition-colors">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-4 h-4 flex items-center justify-center text-[10px] font-bold rounded-full bg-[#007AFF]/10 text-[#007AFF]">{i + 1}</span>
                    {hit.userId === '__org__' ? (
                      <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-blue-50 text-blue-700">共享</span>
                    ) : (
                      <span className="text-[10px] font-mono text-gray-500">{hit.userId || '全局'}</span>
                    )}
                    <span className={`px-1.5 py-0.5 text-[10px] rounded-full ${ht.cls}`}>{ht.label}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px]">
                    {hit.keywordScore !== undefined && <span className="px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700">词 {hit.keywordScore.toFixed(2)}</span>}
                    {hit.vectorScore !== undefined && <span className="px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-700">向 {hit.vectorScore.toFixed(2)}</span>}
                  </div>
                </div>
                <div className="text-xs text-gray-700 mb-1.5 leading-relaxed">{hit.content}</div>
                <div className="flex items-center gap-1.5">
                  <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(hit.score * 100, 100)}%`,
                        background: hit.score >= 0.7 ? '#22c55e' : hit.score >= 0.4 ? '#f59e0b' : '#ef4444',
                      }}
                    />
                  </div>
                  <span className="text-[10px] font-medium text-gray-600 w-7 text-right">{hit.score.toFixed(2)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!testLoading && testResults.length === 0 && testQuery && (
        <div className="text-[11px] text-gray-400 py-5 text-center border border-dashed border-gray-200 rounded-lg">
          未命中任何记忆
        </div>
      )}
    </div>
  );
}
