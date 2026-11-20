const DAY = 24 * 60 * 60 * 1000;

/** "Today", "Yesterday" or a short date. */
export function shortDate(time: number, now = Date.now()): string {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (time >= start.getTime()) return "Today";
  if (time >= start.getTime() - DAY) return "Yesterday";
  return new Date(time).toLocaleDateString(undefined, { month: "short", day: "numeric", year: new Date(time).getFullYear() === start.getFullYear() ? undefined : "numeric" });
}
