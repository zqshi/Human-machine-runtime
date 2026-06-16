/**
 * Register all dock routes — called once at app init
 */
import { registerDockRoute } from './dockRegistry';

// Chat
import { ChatPane } from '../features/chat/ChatPane';
import { MessagesSidebar } from '../features/chat/RoomList';

// Apps
import { AppsGrid } from '../features/apps/AppsGrid';

// Contacts
import { ContactsSidebar, ContactsPage } from '../features/contacts/ContactsPage';

// Knowledge
import { KnowledgeSidebar, KnowledgePage } from '../features/knowledge/KnowledgePage';

// Tasks
import { TodoSidebar, TodoPage } from '../features/todo/TodoPage';

// Notifications
import {
  NotificationsSidebar,
  NotificationsPage,
} from '../features/notifications/NotificationsPage';

// Calendar
import { CalendarSidebar, CalendarPage } from '../features/calendar/CalendarPage';

// Subscription (Feed)
import { FeedSidebar, FeedPage } from '../features/subscription/FeedPage';

// Agents
import { AgentsHub } from '../features/agents/AgentsHub';

// Skills
import { SkillsCenter, SkillsSidebar } from '../features/skills/SkillsCenter';

// Enterprise Agent OS — 五大子系统
import { StrategicCockpitPage } from '../features/strategic-cockpit/StrategicCockpitPage';
import { OrchestrationPage } from '../features/orchestration/OrchestrationPage';
import { SensingPage } from '../features/sensing/SensingPage';
import { EvaluationPage } from '../features/evaluation/EvaluationPage';
import { JudgmentPage } from '../features/judgment/JudgmentPage';

// Studio (Agent Studio)
import { StudioPage } from '../features/studio/StudioPage';

// Marketplace (共享中心)
import { MarketplacePage } from '../features/studio/MarketplacePage';

// Settings
import { SettingsSidebar, SettingsPage } from '../features/settings/SettingsPage';

// OpenClaw
import { OpenClawPage } from '../features/openclaw/OpenClawPage';
import { OpenClawErrorBoundary } from '../features/openclaw/OpenClawErrorBoundary';

export function registerAllRoutes() {
  // Top navigation (matches Dock TOP_ITEMS order)
  registerDockRoute({
    key: 'messages',
    icon: 'chat_bubble',
    label: '消息',
    Sidebar: MessagesSidebar,
    Main: ChatPane,
    position: 'top',
  });
  registerDockRoute({
    key: 'apps',
    icon: 'grid_view',
    label: '轻应用',
    Sidebar: null,
    Main: AppsGrid,
    position: 'top',
  });
  registerDockRoute({
    key: 'contacts',
    icon: 'people',
    label: '通讯录',
    Sidebar: ContactsSidebar,
    Main: ContactsPage,
    position: 'top',
  });
  registerDockRoute({
    key: 'knowledge',
    icon: 'menu_book',
    label: '知识库',
    Sidebar: KnowledgeSidebar,
    Main: KnowledgePage,
    position: 'top',
  });
  registerDockRoute({
    key: 'tasks',
    icon: 'task_alt',
    label: '待办',
    Sidebar: TodoSidebar,
    Main: TodoPage,
    position: 'top',
  });
  registerDockRoute({
    key: 'notifications',
    icon: 'notifications',
    label: '通知',
    Sidebar: NotificationsSidebar,
    Main: NotificationsPage,
    position: 'top',
  });
  registerDockRoute({
    key: 'calendar',
    icon: 'calendar_month',
    label: '日历',
    Sidebar: CalendarSidebar,
    Main: CalendarPage,
    position: 'top',
  });
  registerDockRoute({
    key: 'subscription',
    icon: 'dynamic_feed',
    label: '动态',
    Sidebar: FeedSidebar,
    Main: FeedPage,
    position: 'top',
  });

  // Bottom navigation
  registerDockRoute({
    key: 'agents',
    icon: 'smart_toy',
    label: 'Agent',
    Sidebar: null,
    Main: AgentsHub,
    position: 'bottom',
  });
  registerDockRoute({
    key: 'studio',
    icon: 'category',
    label: 'Studio',
    Sidebar: null,
    Main: StudioPage,
    position: 'bottom',
  });
  registerDockRoute({
    key: 'marketplace',
    icon: 'storefront',
    label: '共享',
    Sidebar: null,
    Main: MarketplacePage,
    position: 'bottom',
  });

  registerDockRoute({
    key: 'settings',
    icon: 'settings',
    label: '设置',
    Sidebar: SettingsSidebar,
    Main: SettingsPage,
    position: 'bottom',
  });

  // OpenClaw — wrapped with dedicated error boundary
  registerDockRoute({
    key: 'openclaw',
    icon: 'terminal',
    label: '工作面板',
    Sidebar: null,
    Main: () => (
      <OpenClawErrorBoundary>
        <OpenClawPage />
      </OpenClawErrorBoundary>
    ),
    position: 'top',
  });

  // Hidden routes (accessible via code but not in Dock)
  registerDockRoute({
    key: 'skills',
    icon: 'bolt',
    label: '技能',
    Sidebar: SkillsSidebar,
    Main: SkillsCenter,
    position: 'top',
  });

  // Enterprise Agent OS — 五大子系统
  registerDockRoute({
    key: 'strategic-cockpit',
    icon: 'flag',
    label: '战略',
    Sidebar: null,
    Main: StrategicCockpitPage,
    position: 'top',
  });
  registerDockRoute({
    key: 'orchestration',
    icon: 'hub',
    label: '编排',
    Sidebar: null,
    Main: OrchestrationPage,
    position: 'top',
  });
  registerDockRoute({
    key: 'sensing',
    icon: 'radar',
    label: '感知',
    Sidebar: null,
    Main: SensingPage,
    position: 'top',
  });
  registerDockRoute({
    key: 'evaluation',
    icon: 'leaderboard',
    label: '考核',
    Sidebar: null,
    Main: EvaluationPage,
    position: 'top',
  });
  registerDockRoute({
    key: 'judgment',
    icon: 'psychology',
    label: '判断',
    Sidebar: null,
    Main: JudgmentPage,
    position: 'top',
  });

  // Admin & Platform — 独立平台入口，不在用户端 SPA 中注册
}
