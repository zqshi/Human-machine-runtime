import { Icon } from '../../components/ui/Icon';

export function LoadingBlock() {
  return (
    <div className="flex items-center justify-center py-8">
      <span className="inline-block w-4 h-4 border-2 border-[#007AFF]/30 border-t-[#007AFF] rounded-full animate-spin" />
    </div>
  );
}

export function EmptyBlock({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="text-sm text-gray-400 py-8 text-center border border-dashed border-gray-200 rounded-lg">
      <Icon name={icon} size={24} className="mx-auto mb-2 opacity-50" />
      <div>{title}</div>
      <div className="text-[11px] mt-1">{desc}</div>
    </div>
  );
}

export function CapabilityRow({
  selected,
  title,
  desc,
  meta,
  onClick,
}: {
  selected: boolean;
  title: string;
  desc: string;
  meta: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
        selected ? 'border-[#007AFF] bg-[#007AFF]/5' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
      }`}
    >
      <div
        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
          selected ? 'border-[#007AFF] bg-[#007AFF]' : 'border-gray-300'
        }`}
      >
        {selected && <Icon name="check" size={12} className="text-white" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-700 truncate">{title}</div>
        <div className="text-[11px] text-gray-400 truncate">{desc}</div>
      </div>
      <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{meta}</span>
    </button>
  );
}

export function Summary({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <div className="text-xs font-medium text-gray-700 mb-2">{title}</div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span key={item} className="px-2 py-1 text-xs bg-white border border-gray-100 rounded-full text-gray-600">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
