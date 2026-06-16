import { useState, useEffect } from 'react';
import { Icon } from '../../components/ui/Icon';
import { SectionLabel } from '../../components/ui/SectionLabel';
import { Avatar } from '../../components/ui/Avatar';
import { useUIStore } from '../../../application/stores/uiStore';
import { useToastStore } from '../../../application/stores/toastStore';
import { logsApi } from '../../../application/services/apiGateway';

interface CalendarEvent {
  id: string;
  title: string;
  time: string;
  duration: string;
  type: 'meeting' | 'task' | 'reminder';
  participants?: string[];
  location?: string;
  /** ISO date string for filtering */
  date: string;
}

function getWeekRange(): [Date, Date] {
  const now = new Date();
  const day = now.getDay();
  const start = new Date(now);
  start.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return [start, end];
}

function getMonthRange(): [Date, Date] {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return [start, end];
}

/**
 * Map an audit log type to a calendar event type.
 */
function auditTypeToEventType(type: string): CalendarEvent['type'] {
  if (/meeting|join|invite/i.test(type)) return 'meeting';
  if (/remind|alert|notify/i.test(type)) return 'reminder';
  return 'task';
}

/**
 * Convert backend audit log entries to CalendarEvent objects.
 */
function mapLogsToEvents(logs: Record<string, unknown>[]): CalendarEvent[] {
  return logs.map((entry, i: number) => {
    const at = entry.at ? new Date(entry.at as string) : new Date();
    const dateStr = at.toISOString().slice(0, 10);
    const timeStr = at.toTimeString().slice(0, 5);
    const eventType = auditTypeToEventType((entry.type as string) ?? '');
    return {
      id: `log-${(entry.id as string) ?? i}`,
      title: (entry.details ?? entry.type ?? '系统事件') as string,
      time: timeStr,
      duration: '',
      type: eventType,
      date: dateStr,
    };
  });
}

const EVENT_STYLES: Record<CalendarEvent['type'], { icon: string; color: string; bg: string }> = {
  meeting: { icon: 'groups', color: '#007AFF', bg: 'bg-primary/8' },
  task: { icon: 'task_alt', color: '#34C759', bg: 'bg-success/8' },
  reminder: { icon: 'notifications', color: '#FF9500', bg: 'bg-warning/8' },
};

type CalendarView = 'today' | 'week' | 'month';

const VIEWS: { key: CalendarView; label: string; icon: string }[] = [
  { key: 'today', label: '今天', icon: 'calendar_today' },
  { key: 'week', label: '本周', icon: 'date_range' },
  { key: 'month', label: '本月', icon: 'calendar_month' },
];

const VIEW_TITLES: Record<CalendarView, string> = {
  today: '今日日程',
  week: '本周日程',
  month: '本月日程',
};

function parseView(subView: string | null): CalendarView {
  if (subView === 'calendar:week') return 'week';
  if (subView === 'calendar:month') return 'month';
  return 'today';
}

function filterEvents(events: CalendarEvent[], view: CalendarView): CalendarEvent[] {
  const now = new Date();
  if (view === 'today') {
    const todayDate = now.toISOString().slice(0, 10);
    return events.filter((e) => e.date === todayDate);
  }
  if (view === 'week') {
    const [start, end] = getWeekRange();
    return events.filter((e) => {
      const d = new Date(e.date);
      return d >= start && d <= end;
    });
  }
  // month
  const [start, end] = getMonthRange();
  return events.filter((e) => {
    const d = new Date(e.date);
    return d >= start && d <= end;
  });
}

function groupByDate(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const groups = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const list = groups.get(e.date) ?? [];
    list.push(e);
    groups.set(e.date, list);
  }
  return groups;
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = dateStr === now.toISOString().slice(0, 10);
  const label = d.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' });
  return isToday ? `${label}（今天）` : label;
}

export function CalendarSidebar() {
  const subView = useUIStore((s) => s.subView);
  const setSubView = useUIStore((s) => s.setSubView);
  const view = parseView(subView);

  const [events, setEvents] = useState<CalendarEvent[]>([]);

  useEffect(() => {
    logsApi
      .list()
      .then((logs) => setEvents(mapLogsToEvents(logs)))
      .catch(() => {});
  }, []);

  const setView = (v: CalendarView) => {
    setSubView(v === 'today' ? null : `calendar:${v}`);
  };

  const filtered = filterEvents(events, view);
  const meetingCount = filtered.filter((e) => e.type === 'meeting').length;
  const taskCount = filtered.filter((e) => e.type === 'task' || e.type === 'reminder').length;

  return (
    <div className="p-4 flex flex-col gap-4">
      <h3 className="text-lg font-semibold text-text-primary">日历</h3>
      <div className="space-y-0.5">
        <SectionLabel>我的日历</SectionLabel>
        {VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            onClick={() => setView(v.key)}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors ${
              view === v.key
                ? 'bg-primary/10 text-primary font-semibold'
                : 'hover:bg-bg-hover text-text-primary font-medium'
            }`}
          >
            <Icon
              name={v.icon}
              size={16}
              className={view === v.key ? 'text-primary' : 'text-text-secondary'}
            />
            <span>{v.label}</span>
          </button>
        ))}
      </div>

      {/* Mini stats */}
      <div className="space-y-0.5">
        <SectionLabel>{VIEW_TITLES[view]}概览</SectionLabel>
        <div className="grid grid-cols-2 gap-2 px-1">
          <div className="p-2 rounded-lg bg-primary/5 text-center">
            <p className="text-lg font-bold text-primary">{meetingCount}</p>
            <p className="text-[10px] text-text-muted">会议</p>
          </div>
          <div className="p-2 rounded-lg bg-success/5 text-center">
            <p className="text-lg font-bold text-success">{taskCount}</p>
            <p className="text-[10px] text-text-muted">任务</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CalendarPage() {
  const subView = useUIStore((s) => s.subView);
  const view = parseView(subView);

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    logsApi
      .list()
      .then((logs) => setEvents(mapLogsToEvents(logs)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = filterEvents(events, view);
  const grouped = groupByDate(filtered);
  const sortedDates = Array.from(grouped.keys()).sort();

  const now = new Date();
  const dateStr = now.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">{VIEW_TITLES[view]}</h2>
            <p className="text-xs text-text-muted mt-0.5">{dateStr}</p>
          </div>
        </div>

        {loading && (
          <div className="text-center py-12 text-text-muted text-sm">
            <Icon name="hourglass_empty" size={40} className="opacity-30 mb-2 animate-spin" />
            <p>加载日程中...</p>
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-12 text-text-muted text-sm">
            <Icon name="event_busy" size={40} className="opacity-30 mb-2" />
            <p>暂无日程</p>
          </div>
        )}

        {!loading &&
          sortedDates.map((date) => {
            const events = grouped.get(date)!;
            return (
              <div key={date} className="mb-6">
                {view !== 'today' && (
                  <h3 className="text-sm font-semibold text-text-secondary mb-3">
                    {formatDateLabel(date)}
                  </h3>
                )}
                <div className="relative">
                  <div className="absolute left-[59px] top-0 bottom-0 w-px bg-border" />
                  <div className="space-y-4">
                    {events.map((event) => {
                      const style = EVENT_STYLES[event.type];
                      return (
                        <div key={event.id} className="flex gap-4 group">
                          <div className="w-[48px] text-right shrink-0 pt-2.5">
                            <span className="text-xs font-medium text-text-primary">
                              {event.time}
                            </span>
                          </div>
                          <div className="relative shrink-0 pt-3">
                            <span
                              className="block w-2.5 h-2.5 rounded-full border-2 border-white"
                              style={{ backgroundColor: style.color }}
                            />
                          </div>
                          <div
                            className="flex-1 p-3 rounded-xl border border-border hover:shadow-sm transition-shadow cursor-pointer"
                            onClick={() =>
                              useToastStore.getState().addToast(`查看日程: ${event.title}`, 'info')
                            }
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <div
                                className={`w-6 h-6 rounded-md ${style.bg} flex items-center justify-center`}
                              >
                                <Icon name={style.icon} size={14} style={{ color: style.color }} />
                              </div>
                              <span className="text-sm font-medium text-text-primary">
                                {event.title}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-[11px] text-text-muted ml-8">
                              <span>{event.duration}</span>
                              {event.location && (
                                <span className="flex items-center gap-0.5">
                                  <Icon name="location_on" size={12} />
                                  {event.location}
                                </span>
                              )}
                            </div>
                            {event.participants && (
                              <div className="flex items-center gap-0.5 ml-8 mt-2">
                                {event.participants.map((p) => (
                                  <Avatar key={p} letter={p} size={22} />
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
