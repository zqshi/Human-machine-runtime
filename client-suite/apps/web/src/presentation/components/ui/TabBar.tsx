interface Tab {
  key: string;
  label: string;
}

interface TabBarProps {
  tabs: Tab[];
  activeKey: string;
  onChange: (key: string) => void;
  className?: string;
}

export function TabBar({ tabs, activeKey, onChange, className = '' }: TabBarProps) {
  return (
    <div className={`flex gap-1 p-0.5 rounded-lg bg-black/[0.04] ${className}`}>
      {tabs.map((tab) => (
        <button
          type="button"
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`flex-1 h-7 rounded-md text-xs font-medium transition-all ${
            activeKey === tab.key
              ? 'bg-bg-white-var text-text-primary shadow-sm'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
