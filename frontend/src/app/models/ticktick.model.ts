export interface TickTickConnection {
  available: boolean;
  connected: boolean;
  needs_reauthorize: boolean;
  connected_at: string | null;
  revocation_failed?: boolean;
}

export interface TickTickTask {
  id: string;
  project_id: string;
  list: string;
  title: string;
  priority: number;
  due_date: string;
  time_zone: string;
  is_all_day: boolean;
}

export interface TickTickToday {
  state: 'ready' | 'partial' | 'stale' | 'not_connected' | 'reauthorize' | 'unavailable';
  date: string;
  time_zone: string;
  tasks: TickTickTask[];
  fetched_at: string | null;
  warnings: string[];
  inbox_read: boolean;
}

export function tickTickDay(now = new Date()): { date: string; zone: string } {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return { date: `${part('year')}-${part('month')}-${part('day')}`, zone };
}
