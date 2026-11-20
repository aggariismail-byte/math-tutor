import { pathFor, ticks } from "@/client/lib/plot";

export const SERIES_STROKES = ["stroke-chart-1", "stroke-chart-2", "stroke-chart-3", "stroke-chart-4", "stroke-chart-5"];
export const SERIES_FILLS = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5"];

const WIDTH = 640;
const HEIGHT = 420;
const PAD = 32;

export interface Range {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

/** Functions of x drawn on axes over the range. `series` keeps each one's colour slot. */
export function GraphPlot({
  series,
  range,
}: {
  series: { slot: number; fn: (x: number) => number; label: string }[];
  range: Range;
}) {
  const valid = range.xMin < range.xMax && range.yMin < range.yMax;
  const inner = { width: WIDTH - PAD, height: HEIGHT - PAD };
  const sx = (x: number) => PAD + ((x - range.xMin) / (range.xMax - range.xMin)) * inner.width;
  const sy = (y: number) => inner.height - ((y - range.yMin) / (range.yMax - range.yMin)) * inner.height;
  const xTicks = valid ? ticks(range.xMin, range.xMax) : [];
  const yTicks = valid ? ticks(range.yMin, range.yMax, 6) : [];
  const xAxis = valid && range.yMin <= 0 && range.yMax >= 0 ? sy(0) : null;
  const yAxis = valid && range.xMin <= 0 && range.xMax >= 0 ? sx(0) : null;

  return (
    <svg
      data-testid="graph-plot"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="w-full rounded-lg border border-border bg-card"
      role="img"
      aria-label={series.length ? `Plot of ${series.map((s) => s.label).join(", ")}` : "Empty plot"}
    >
      {valid ? (
        <>
          <g className="stroke-border" strokeWidth={1}>
            {xTicks.map((t) => (
              <line key={`gx${t}`} x1={sx(t)} x2={sx(t)} y1={0} y2={inner.height} />
            ))}
            {yTicks.map((t) => (
              <line key={`gy${t}`} x1={PAD} x2={WIDTH} y1={sy(t)} y2={sy(t)} />
            ))}
          </g>
          <g className="stroke-muted-foreground" strokeWidth={1.25}>
            {xAxis !== null ? <line x1={PAD} x2={WIDTH} y1={xAxis} y2={xAxis} /> : null}
            {yAxis !== null ? <line x1={yAxis} x2={yAxis} y1={0} y2={inner.height} /> : null}
          </g>
          <g className="fill-muted-foreground text-[11px]">
            {xTicks.map((t) => (
              <text key={`lx${t}`} x={sx(t)} y={HEIGHT - 12} textAnchor="middle">
                {formatTick(t)}
              </text>
            ))}
            {yTicks.map((t) => (
              <text key={`ly${t}`} x={PAD - 6} y={sy(t) + 4} textAnchor="end">
                {formatTick(t)}
              </text>
            ))}
          </g>
          <svg x={PAD} y={0} width={inner.width} height={inner.height} overflow="hidden">
            {series.map((s) => (
              <path
                key={s.slot}
                data-testid="series"
                d={pathFor(s.fn, range, inner)}
                fill="none"
                strokeWidth={2.25}
                strokeLinejoin="round"
                strokeLinecap="round"
                className={SERIES_STROKES[s.slot % SERIES_STROKES.length]}
              />
            ))}
          </svg>
        </>
      ) : null}
    </svg>
  );
}

function formatTick(value: number): string {
  return Math.abs(value) >= 1e4 || (Math.abs(value) < 1e-3 && value !== 0)
    ? value.toExponential(0)
    : String(Number(value.toPrecision(6)));
}
