import { compile, type EvalFunction } from "mathjs";

export type Compiled = { ok: true; fn: (x: number) => number } | { ok: false; error: string };

/** An expression in x as a function, or why it can't be plotted. */
export function compileExpression(source: string): Compiled {
  const text = source.trim();
  if (!text) return { ok: false, error: "Enter an expression" };
  let code: EvalFunction;
  try {
    code = compile(text);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Can't read this expression" };
  }
  const fn = (x: number) => {
    const value: unknown = code.evaluate({ x });
    if (typeof value === "number") return value;
    if (value && typeof value === "object" && "re" in value && "im" in value) {
      const complex = value as { re: number; im: number };
      return Math.abs(complex.im) < 1e-12 ? complex.re : Number.NaN;
    }
    throw new Error("Not a function of x");
  };
  try {
    for (const x of [0.37, -1.3, 2.9]) fn(x);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Not a function of x";
    return { ok: false, error: message.startsWith("Undefined symbol") ? `${message}: use x as the variable` : message };
  }
  return { ok: true, fn };
}

/** About `count` round tick values covering [min, max]. */
export function ticks(min: number, max: number, count = 8): number[] {
  const span = max - min;
  if (!(span > 0)) return [];
  const raw = span / count;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * power).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) {
    out.push(Math.abs(v) < step * 1e-9 ? 0 : Number(v.toPrecision(12)));
  }
  return out;
}

/** SVG path data for fn over the ranges, broken where it leaves the plot or is undefined. */
export function pathFor(
  fn: (x: number) => number,
  range: { xMin: number; xMax: number; yMin: number; yMax: number },
  size: { width: number; height: number },
  samples = 600,
): string {
  const { xMin, xMax, yMin, yMax } = range;
  const toX = (x: number) => ((x - xMin) / (xMax - xMin)) * size.width;
  const toY = (y: number) => size.height - ((y - yMin) / (yMax - yMin)) * size.height;
  const limit = (yMax - yMin) * 4;
  let d = "";
  let drawing = false;
  let previous: number | null = null;
  for (let i = 0; i <= samples; i++) {
    const x = xMin + ((xMax - xMin) * i) / samples;
    let y: number;
    try {
      y = fn(x);
    } catch {
      y = Number.NaN;
    }
    const usable = Number.isFinite(y) && y > yMin - limit && y < yMax + limit;
    const jump = previous !== null && usable && Math.abs(y - previous) > (yMax - yMin) * 2;
    if (!usable || jump) {
      drawing = false;
      previous = usable ? y : null;
      if (!usable) continue;
    }
    const point = `${toX(x).toFixed(2)},${toY(y).toFixed(2)}`;
    d += drawing ? `L${point}` : `M${point}`;
    drawing = true;
    previous = y;
  }
  return d;
}
