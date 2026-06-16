import { Icon } from './Icon';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: string;
  color?: string;
  detail?: string;
}

export function StatCard({ label, value, icon, color = '#007AFF', detail }: StatCardProps) {
  return (
    <div className="group relative bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3 transition-all duration-200 hover:shadow-md hover:border-gray-300 hover:-translate-y-0.5 cursor-default">
      {icon && (
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors duration-200 group-hover:scale-105"
          style={{ backgroundColor: `${color}10` }}
        >
          <Icon name={icon} size={20} className="text-[color]" style={{ color }} />
        </div>
      )}
      <div className="min-w-0">
        <div className="text-xl font-semibold text-gray-900 truncate">{value}</div>
        <div className="text-xs text-gray-500">{label}</div>
      </div>
      {detail && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 z-10">
          {detail}
          <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-gray-900" />
        </div>
      )}
    </div>
  );
}
