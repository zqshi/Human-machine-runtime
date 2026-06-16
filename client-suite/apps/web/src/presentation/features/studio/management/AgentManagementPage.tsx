/**
 * AgentManagementPage — Agent 管理主页面（侧栏导航 + 内容区）
 *
 * 对应设计源的 AgentLayout：编排配置 / 知识库 / 基础管理 / 发布管理 / 运营监控
 */
import {
  useStudioStore,
  useManagingAgent,
  type ManagementTab,
} from '../../../../application/stores/studioStore';
import { Icon } from '../../../components/ui/Icon';
import { AgentOrchestrationPage } from '../orchestration/AgentOrchestrationPage';
import { AgentSettingsPage } from './AgentSettingsPage';
import { AgentReleasePage } from './AgentReleasePage';
import { AgentAnalyticsPage } from './AgentAnalyticsPage';
import { AgentKnowledgePage } from './AgentKnowledgePage';

const NAV_SECTIONS: {
  title: string;
  items: { key: ManagementTab; icon: string; label: string }[];
}[] = [
  {
    title: '开发配置',
    items: [
      { key: 'orchestration', icon: 'edit_note', label: '编排配置' },
      { key: 'knowledge', icon: 'menu_book', label: '知识库' },
    ],
  },
  {
    title: '运营管理',
    items: [
      { key: 'settings', icon: 'settings', label: '基础管理' },
      { key: 'release', icon: 'rocket_launch', label: '发布管理' },
      { key: 'analytics', icon: 'bar_chart', label: '运营监控' },
    ],
  },
];

export function AgentManagementPage() {
  const agentId = useStudioStore((s) => s.managingAgentId);
  const activeTab = useStudioStore((s) => s.managementTab);
  const setTab = useStudioStore((s) => s.setManagementTab);
  const closeManagement = useStudioStore((s) => s.closeAgentManagement);
  const agent = useManagingAgent();

  if (!agentId || !agent) return null;

  return (
    <div className="flex-1 flex h-full overflow-hidden">
      {/* Sidebar */}
      <aside className="w-52 flex flex-col border-r border-white/[0.06] bg-white/[0.02] shrink-0">
        {/* Back button */}
        <button
          onClick={closeManagement}
          className="flex items-center gap-2 px-4 py-3 text-[11px] text-slate-400 hover:text-primary border-b border-white/[0.06] transition-colors"
        >
          <Icon name="arrow_back" size={13} />
          返回 Studio
        </button>

        {/* Agent header */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/[0.06]">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-sky-600 flex items-center justify-center text-white text-[11px] font-semibold shrink-0">
            {agent.icon || 'AI'}
          </div>
          <div className="min-w-0">
            <div className="text-[12px] font-semibold text-slate-100 truncate">{agent.name}</div>
            <div className="text-[10px] text-slate-500">Agent · {agent.version || 'v0.0.1'}</div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-2 overflow-y-auto dcf-scrollbar">
          {NAV_SECTIONS.map((section) => (
            <div key={section.title} className="mb-1">
              <div className="px-3 pt-2 pb-1.5 text-[9px] font-semibold uppercase tracking-wider text-slate-600">
                {section.title}
              </div>
              {section.items.map((item) => (
                <button
                  key={item.key}
                  onClick={() => setTab(item.key)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] transition-all text-left ${
                    activeTab === item.key
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-200'
                  }`}
                >
                  <Icon name={item.icon} size={14} />
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </nav>

        {/* Footer status */}
        <div className="px-4 py-2.5 border-t border-white/[0.06]">
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
            <span
              className={`w-1.5 h-1.5 rounded-full ${agent.status === 'published' ? 'bg-emerald-400' : 'bg-slate-500'}`}
            />
            {agent.status === 'published'
              ? '已发布'
              : agent.status === 'running'
                ? '运行中'
                : '草稿'}
            {agent.version && ` · ${agent.version}`}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {activeTab === 'orchestration' && <AgentOrchestrationPage agentId={agentId} />}
        {activeTab === 'knowledge' && <AgentKnowledgePage />}
        {activeTab === 'settings' && <AgentSettingsPage />}
        {activeTab === 'release' && <AgentReleasePage />}
        {activeTab === 'analytics' && <AgentAnalyticsPage />}
      </main>
    </div>
  );
}
