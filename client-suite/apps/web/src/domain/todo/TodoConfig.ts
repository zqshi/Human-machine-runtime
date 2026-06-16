export const SMART_VIEWS = [
  { id: 'list-today', label: '今日待办', icon: 'calendar_today' },
  { id: 'list-upcoming', label: '即将到来', icon: 'upcoming' },
  { id: 'list-completed', label: '已完成', icon: 'task_alt' },
] as const;

export const CUSTOM_LISTS = [
  { id: 'list-work', label: '工作项目', color: '#FF9500' },
  { id: 'list-personal', label: '个人生活', color: '#AF52DE' },
] as const;
