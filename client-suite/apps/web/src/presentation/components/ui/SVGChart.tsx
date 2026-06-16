import { useRef, useState, useEffect } from 'react';

interface DataPoint {
  label: string;
  value: number;
}

interface LineChartProps {
  data: DataPoint[];
  width?: number;
  height?: number;
  color?: string;
  showArea?: boolean;
  minPointSpacing?: number;
}

function computePath(data: DataPoint[], width: number, height: number, padT: number, padB: number) {
  if (data.length < 2) return { path: '', areaPath: '', points: [] };
  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const plotH = height - padT - padB;
  const stepX = width / (data.length - 1);

  const points = data.map((d, i) => ({
    x: i * stepX,
    y: padT + plotH - ((d.value - min) / range) * plotH,
  }));

  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');
  const areaPath = `${path} L${points[points.length - 1].x.toFixed(1)},${height - padB} L0,${height - padB} Z`;

  return { path, areaPath, points };
}

function labelInterval(count: number, containerW: number): number {
  if (count <= 1) return 1;
  const maxLabels = Math.floor(containerW / 64);
  if (count <= maxLabels) return 1;
  return Math.ceil(count / maxLabels);
}

export function LineChart({
  data,
  width: fixedWidth,
  height = 120,
  color = '#007AFF',
  showArea = true,
  minPointSpacing = 40,
}: LineChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState(fixedWidth || 280);

  useEffect(() => {
    if (fixedWidth) return;
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setContainerW(w);
    });
    observer.observe(el);
    setContainerW(el.clientWidth || 280);
    return () => observer.disconnect();
  }, [fixedWidth]);

  if (!data.length) {
    return (
      <div
        ref={containerRef}
        className="flex items-center justify-center text-xs text-gray-400"
        style={{ width: fixedWidth || '100%', height }}
      >
        暂无数据
      </div>
    );
  }

  const minW = data.length > 1 ? (data.length - 1) * minPointSpacing : minPointSpacing;
  const svgW = fixedWidth || Math.max(containerW, minW);
  const needsScroll = !fixedWidth && svgW > containerW;

  const padT = 8;
  const padB = 22;
  const { path, areaPath, points } = computePath(data, svgW, height, padT, padB);
  const stepX = data.length > 1 ? svgW / (data.length - 1) : svgW;
  const interval = labelInterval(data.length, svgW);

  return (
    <div
      ref={containerRef}
      className={needsScroll ? 'overflow-x-auto' : ''}
      style={{ width: fixedWidth || '100%' }}
    >
      <svg width={svgW} height={height} className="block">
        {showArea && <path d={areaPath} fill={`${color}15`} />}
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="2.5" fill={color} />
        ))}
        {data.map((d, i) => {
          if (i % interval !== 0 && i !== data.length - 1) return null;
          return (
            <text
              key={i}
              x={i * stepX}
              y={height - 4}
              textAnchor="middle"
              className="fill-gray-400"
              fontSize="9"
            >
              {d.label.length > 5 ? d.label.slice(5) : d.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

interface BarChartProps {
  data: { label: string; value: number; color?: string }[];
  width?: number;
  height?: number;
}

export function BarChart({ data, width = 280, height = 120 }: BarChartProps) {
  if (!data.length) {
    return (
      <div
        className="flex items-center justify-center text-xs text-gray-400"
        style={{ width, height }}
      >
        暂无数据
      </div>
    );
  }

  const max = Math.max(...data.map((d) => d.value));
  const barWidth = Math.min(32, (width - 8 * data.length) / data.length);
  const padT = 4;
  const padB = 18;
  const plotH = height - padT - padB;
  const colors = ['#007AFF', '#34C759', '#AF52DE', '#FF9500', '#FF3B30', '#5AC8FA'];

  return (
    <svg width={width} height={height} className="block">
      {data.map((d, i) => {
        const barH = max > 0 ? (d.value / max) * plotH : 0;
        const x = i * (barWidth + 8) + 4;
        const y = padT + plotH - barH;
        const fill = d.color || colors[i % colors.length];
        return (
          <g key={i}>
            <rect x={x} y={y} width={barWidth} height={barH} rx="3" fill={fill} opacity="0.85" />
            <text
              x={x + barWidth / 2}
              y={height - 4}
              textAnchor="middle"
              className="fill-gray-400"
              fontSize="9"
            >
              {d.label.length > 4 ? d.label.slice(0, 4) : d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
