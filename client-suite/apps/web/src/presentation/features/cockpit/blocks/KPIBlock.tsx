import { Icon } from '../../../components/ui/Icon';

interface KPIItem {
  label: string;
  value: string;
  trend?: 'up' | 'down' | 'flat';
}

interface Props {
  items: KPIItem[];
}

const trendConfig: Record<
  NonNullable<KPIItem['trend']>,
  { icon: string; color: string }
> = {
  up: { icon: 'trending_up', color: 'text-emerald-400' },
  down: { icon: 'trending_down', color: 'text-red-400' },
  flat: { icon: 'trending_flat', color: 'text-slate-400' },
};

export function KPIBlockComponent({ items }: Props) {
  return (
    <div className="flex gap-3">
      {items.map((item, i) => (
        <div key={i} className="flex-1 rounded-lg bg-white/[0.04] p-3">
          <div className="text-[10px] text-slate-500 mb-1">{item.label}</div>
          <div className="flex items-end gap-1.5">
            <span className="text-lg font-bold text-primary leading-none">
              {item.value}
            </span>
            {item.trend && (
              <Icon
                name={trendConfig[item.trend].icon}
                size={14}
                className={trendConfig[item.trend].color}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
