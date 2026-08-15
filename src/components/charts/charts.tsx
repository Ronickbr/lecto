import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface RadarDatum {
  process: string;
  value: number;
}

export interface SeriesDatum {
  name: string;
  pct: number;
}

export interface XYDatum {
  name: string;
  value: number;
}

export interface SliceDatum {
  name: string;
  value: number;
}

const PRIMARY = "var(--primary)";
const SLICE_COLORS = [
  "var(--primary)",
  "var(--chart-2, var(--accent-foreground))",
  "var(--muted-foreground)",
  "var(--destructive)",
];

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "var(--popover)",
  color: "var(--popover-foreground)",
  fontSize: 12,
} as const;

export function ProcessRadar({ data }: { data: RadarDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RadarChart data={data} outerRadius="70%">
        <PolarGrid />
        <PolarAngleAxis dataKey="process" tick={{ fontSize: 12 }} />
        <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
        <Radar
          dataKey="value"
          stroke={PRIMARY}
          fill={PRIMARY}
          fillOpacity={0.35}
          isAnimationActive={false}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}

export function TrendLine({ data }: { data: SeriesDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
        <Tooltip contentStyle={tooltipStyle} />
        <Line
          type="monotone"
          dataKey="pct"
          stroke={PRIMARY}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function ScoreBars({ data }: { data: SeriesDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
        <Tooltip contentStyle={tooltipStyle} />
        <Bar dataKey="pct" fill={PRIMARY} radius={[6, 6, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Linha genérica (crescimento de escolas, receita mensal…). */
export function MetricLine({
  data,
  formatter,
}: {
  data: XYDatum[];
  formatter?: (v: number) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={52} />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(v: number) => (formatter ? formatter(v) : v)}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke={PRIMARY}
          strokeWidth={2.5}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Área (usuários ativos por dia). */
export function MetricArea({ data }: { data: XYDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <defs>
          <linearGradient id="metricAreaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={PRIMARY} stopOpacity={0.35} />
            <stop offset="100%" stopColor={PRIMARY} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={40} />
        <Tooltip contentStyle={tooltipStyle} />
        <Area
          type="monotone"
          dataKey="value"
          stroke={PRIMARY}
          strokeWidth={2}
          fill="url(#metricAreaFill)"
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Barras genéricas (simulados realizados). */
export function MetricBars({ data }: { data: XYDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={40}
          allowDecimals={false}
        />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
        <Bar dataKey="value" fill={PRIMARY} radius={[8, 8, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Pizza / donut (distribuição de planos). */
export function MetricPie({ data }: { data: SliceDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius="55%"
          outerRadius="80%"
          paddingAngle={3}
          isAnimationActive={false}
        >
          {data.map((entry, i) => (
            <Cell
              key={entry.name}
              fill={SLICE_COLORS[i % SLICE_COLORS.length]}
              opacity={1 - i * 0.18}
            />
          ))}
        </Pie>
        <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 12 }} />
        <Tooltip contentStyle={tooltipStyle} />
      </PieChart>
    </ResponsiveContainer>
  );
}
