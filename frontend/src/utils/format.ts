/** Compact token count: 517 / 12.2K / 1.2M. */
export function fmtTok(value: number | null | undefined) {
  if (value == null) return '0';
  if (value < 1_000) return String(value);
  if (value < 1_000_000) return `${value >= 100_000 ? Math.round(value / 1_000) : Math.round(value / 100) / 10}K`;
  return `${value >= 100_000_000 ? Math.round(value / 1_000_000) : Math.round(value / 100_000) / 10}M`;
}
