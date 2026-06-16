interface FilterOption {
  value: string;
  label: string;
}

interface FilterDef {
  key: string;
  label: string;
  type: 'text' | 'select';
  placeholder?: string;
  options?: FilterOption[];
}

interface FilterBarProps {
  filters: FilterDef[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onSearch?: () => void;
}

export function FilterBar({ filters, values, onChange, onSearch }: FilterBarProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && onSearch) {
      e.preventDefault();
      onSearch();
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {filters.map((filter) =>
        filter.type === 'select' ? (
          <select
            key={filter.key}
            value={values[filter.key] || ''}
            onChange={(e) => onChange(filter.key, e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF]"
          >
            <option value="">{filter.placeholder || filter.label}</option>
            {filter.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            key={filter.key}
            type="text"
            placeholder={filter.placeholder || filter.label}
            value={values[filter.key] || ''}
            onChange={(e) => onChange(filter.key, e.target.value)}
            onKeyDown={handleKeyDown}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] w-44"
          />
        )
      )}
    </div>
  );
}
