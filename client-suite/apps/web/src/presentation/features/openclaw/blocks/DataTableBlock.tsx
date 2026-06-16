import type { OpenClawDrawerContent } from '../../../../domain/agent/DrawerContent';

interface Props {
  title: string;
  columns: string[];
  rows: string[][];
  truncated?: boolean;
  onOpen: (content: OpenClawDrawerContent) => void;
}

const MAX_VISIBLE_ROWS = 5;

export function DataTableBlockComponent({
  title,
  columns,
  rows,
  truncated,
  onOpen,
}: Props) {
  const visibleRows = rows.slice(0, MAX_VISIBLE_ROWS);

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
      {/* Title */}
      <div className="px-3 pt-2.5 pb-1.5">
        <span className="text-xs font-medium text-slate-200">{title}</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-white/5">
              {columns.map((col, i) => (
                <th
                  key={i}
                  className="px-3 py-1.5 text-left text-slate-400 font-medium whitespace-nowrap"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, ri) => (
              <tr key={ri} className="border-b border-white/5 last:border-b-0">
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className="px-3 py-1.5 text-slate-200 whitespace-nowrap"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Expand */}
      {truncated && (
        <button
          type="button"
          className="w-full px-3 py-2 text-[11px] text-primary hover:bg-white/[0.04] transition-colors text-center"
          onClick={() =>
            onOpen({ type: 'data-explorer', title, data: { columns, rows } })
          }
        >
          查看完整数据 →
        </button>
      )}
    </div>
  );
}
