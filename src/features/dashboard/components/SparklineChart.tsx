export interface SparklineChartProps {
  data: number[];
  color?: string;
  height?: number;
  width?: number;
  maxValue?: number;
  className?: string;
}

export function SparklineChart({
  data,
  color = '#3b82f6',
  height = 30,
  width = 150,
  maxValue,
  className = ''
}: SparklineChartProps) {
  if (!data || data.length === 0) {
    return <svg width={width} height={height} className={className} />;
  }

  const max = maxValue !== undefined ? maxValue : Math.max(...data, 1);
  const min = 0;
  const range = max - min;

  // Calculate points for the path
  const points = data.map((val, i) => {
    const x = (i / Math.max(data.length - 1, 1)) * width;
    const y = height - ((val - min) / Math.max(range, 1)) * height;
    return `${x},${y}`;
  });

  const pathD = `M ${points.join(' L ')}`;
  const fillD = `${pathD} L ${width},${height} L 0,${height} Z`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className}>
      <defs>
        <linearGradient id={`gradient-${color.replace('#', '')}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fillD} fill={`url(#gradient-${color.replace('#', '')})`} />
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}


