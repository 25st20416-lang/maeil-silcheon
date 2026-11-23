const DAY = 86400000;
const KST = 9 * 3600000;
export type Task = { id: string; name: string; time: string; created: string };

export function validateTasks(value: unknown): Task[] {
  if (!Array.isArray(value) || value.length > 100) throw new Error('실천은 최대 100개까지 저장할 수 있어요.');
  const ids = new Set<string>();
  return value.map((t: Record<string, unknown>) => {
    if (!t || typeof t !== 'object' || typeof t.id !== 'string' || !/^[\w-]{1,100}$/.test(t.id) || t.id.startsWith('__') || ids.has(t.id) ||
        typeof t.name !== 'string' || !t.name.trim() || t.name.length > 200 ||
        typeof t.created !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(t.created) ||
        !Number.isFinite(Date.parse(t.created + 'T00:00:00Z')) ||
        (t.time !== '' && (typeof t.time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(t.time)))) throw new Error('일정 이름과 시간을 확인해 주세요.');
    ids.add(t.id);
    return { id: t.id, name: t.name.trim(), time: t.time as string, created: t.created };
  });
}
export function nextDue(time: string, created: string, offset: number, now: number) {
  const localDay = new Date(now + KST).toISOString().slice(0, 10);
  const day = created > localDay ? created : localDay;
  let due = Date.parse(day + 'T' + time + ':00+09:00') - offset;
  if (due <= now) due += (Math.floor((now - due) / DAY) + 1) * DAY;
  return due;
}
export const advanceDue = (due: number, now: number) => due + (Math.floor((now - due) / DAY) + 1) * DAY;

export function scheduleStatements(db: D1Database, device: string, tasks: Task[], now: number) {
  const timed = tasks.filter(t => t.time);
  const all = [{ id: '__morning__', name: '오늘의 실천을 하나씩 시작해 보세요.', time: '07:00', created: '2020-01-01' }, ...timed];
  const statements = all.map(t => db.prepare(`
    INSERT INTO notification_schedules(device_id,task_id,name,time,created,next_at) VALUES(?,?,?,?,?,?)
    ON CONFLICT(device_id,task_id) DO UPDATE SET
    next_at=CASE WHEN notification_schedules.time=excluded.time AND notification_schedules.created=excluded.created
      THEN notification_schedules.next_at ELSE excluded.next_at END,
    name=excluded.name,time=excluded.time,created=excluded.created
  `).bind(device, t.id, t.name, t.time, t.created, nextDue(t.time, t.created, t.id === '__morning__' ? 0 : 1800000, now)));
  statements.push(db.prepare('DELETE FROM notification_schedules WHERE device_id=? AND task_id NOT IN (SELECT value FROM json_each(?))').bind(device, JSON.stringify(all.map(t => t.id))));
  return statements;
}
