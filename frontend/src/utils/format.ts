/** Compact token count: 517 / 12.2K / 1.2M. */
export function fmtTok(value: number | null | undefined) {
  if (value == null) return '0';
  if (value < 1_000) return String(value);
  if (value < 1_000_000) return `${value >= 100_000 ? Math.round(value / 1_000) : Math.round(value / 100) / 10}K`;
  return `${value >= 100_000_000 ? Math.round(value / 1_000_000) : Math.round(value / 100_000) / 10}M`;
}

/** Human-readable age for persisted work items without inventing activity data. */
export function formatRecentTime(value: string | number | Date | null | undefined, now = Date.now()) {
  if (!value) return '最近';
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return '最近';
  const elapsed = Math.max(0, now - timestamp);
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days === 1) return '昨天';
  if (days < 7) return `${days} 天前`;
  return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric' }).format(timestamp);
}
