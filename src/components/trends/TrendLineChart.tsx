import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export type TrendChartRow = {
  dateMs: number;
  value: number;
  detail: string;
};

type Props = {
  title: string;
  subtitle?: string;
  data: TrendChartRow[];
  valueLabel: string;
  stroke: string;
};

function formatAxisDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
}

const Y_PADDING_LB = 10;

function yAxisDomain(data: TrendChartRow[]): [number, number] {
  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  return [Math.max(0, min - Y_PADDING_LB), max + Y_PADDING_LB];
}

export default function TrendLineChart({ title, subtitle, data, valueLabel, stroke }: Props) {
  if (data.length === 0) {
    return (
      <div className="card stack" style={{ gap: '0.35rem' }}>
        <h2 style={{ margin: 0, fontSize: '1rem' }}>{title}</h2>
        {subtitle && <p className="muted" style={{ margin: 0 }}>{subtitle}</p>}
        <p className="muted" style={{ margin: 0 }}>
          No working sets in loaded sessions.
        </p>
      </div>
    );
  }

  const yDomain = yAxisDomain(data);

  return (
    <div className="card stack" style={{ gap: '0.5rem' }}>
      <div>
        <h2 style={{ margin: 0, fontSize: '1rem' }}>{title}</h2>
        {subtitle && (
          <p className="muted" style={{ margin: '0.25rem 0 0' }}>
            {subtitle}
          </p>
        )}
      </div>
      <div style={{ width: '100%', height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
            <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
            <XAxis
              dataKey="dateMs"
              type="number"
              scale="time"
              domain={['dataMin', 'dataMax']}
              tickFormatter={formatAxisDate}
              stroke="#94a3b8"
              tick={{ fontSize: 11 }}
              minTickGap={28}
            />
            <YAxis
              domain={yDomain}
              allowDataOverflow
              stroke="#94a3b8"
              tick={{ fontSize: 11 }}
              width={40}
              tickFormatter={(v: number) => String(Math.round(v))}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0]!.payload as TrendChartRow;
                return (
                  <div
                    style={{
                      background: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: 8,
                      padding: '0.5rem 0.65rem',
                      fontSize: '0.8125rem',
                    }}
                  >
                    <div style={{ color: '#94a3b8', marginBottom: 4 }}>
                      {new Date(Number(label)).toLocaleDateString(undefined, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </div>
                    <div style={{ fontWeight: 600 }}>
                      {Math.round(row.value)} lb — {valueLabel}
                    </div>
                    <div className="muted" style={{ marginTop: 4, color: '#94a3b8' }}>
                      {row.detail}
                    </div>
                  </div>
                );
              }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={stroke}
              strokeWidth={2}
              dot={{ r: 3, fill: stroke }}
              activeDot={{ r: 5 }}
              name={valueLabel}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
