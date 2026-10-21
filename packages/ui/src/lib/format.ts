const GB = 1024 ** 3;
const MB = 1024 ** 2;

export function formatBytes(bytes: number | undefined): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes <= 0) return '0 ГБ';
  if (bytes >= GB) {
    const value = bytes / GB;
    return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: value >= 100 ? 0 : 1 }).format(value)} ГБ`;
  }
  if (bytes >= MB) {
    const value = bytes / MB;
    return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value)} МБ`;
  }
  return `${Math.round(bytes / 1024)} КБ`;
}

export function formatTrafficPair(used: number, total: number | undefined): string {
  if (!total) return formatBytes(used);
  return `${formatBytes(used)} из ${formatBytes(total)}`;
}

export function formatDate(timestampSeconds: number | undefined): string {
  if (!timestampSeconds) return '—';
  const date = new Date(timestampSeconds * 1000);
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

export function formatUpdated(timestampMs: number): string {
  const date = new Date(timestampMs);
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
    .format(date)
    .replace(',', ',');
}

export function formatUptime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hours > 0)
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

export function stripFlag(name: string): string {
  return name.replace(/[\u{1F1E6}-\u{1F1FF}]{2}\s*/gu, '').trim();
}

export function todayLabel(): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date());
}
