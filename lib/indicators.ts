import { getSettings } from './booking-engine';
import { ApiError, database, zonedDateTimeToUtcIso } from './nexius';

type Interval = [number, number];
function minutes(intervals: Interval[]) {
  const sorted = intervals
    .filter(([start, end]) => end > start)
    .sort((a, b) => a[0] - b[0]);
  let total = 0,
    end = -Infinity;
  for (const [start, finish] of sorted) {
    total += Math.max(0, finish - Math.max(start, end));
    end = Math.max(end, finish);
  }
  return total / 60000;
}
export async function periodIndicators(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
    throw new ApiError(400, 'Mês inválido.', 'invalid_month');
  const db = database(),
    { timezone } = await getSettings();
  const [year, m] = month.split('-').map(Number),
    lastDay = new Date(Date.UTC(year, m, 0)).getUTCDate();
  const start = zonedDateTimeToUtcIso(`${month}-01`, 0, timezone),
    next = new Date(Date.UTC(year, m, 1)).toISOString().slice(0, 10),
    end = zonedDateTimeToUtcIso(next, 0, timezone);
  const [schedules, blocks, bookings] = await Promise.all([
    db
      .prepare(
        `SELECT w.professional_id as professionalId, w.weekday, MAX(w.start_minute,u.start_minute) as startMinute, MIN(w.end_minute,u.end_minute) as endMinute, w.break_start_minute as breakStart, w.break_end_minute as breakEnd FROM weekly_schedules w JOIN professionals p ON p.id=w.professional_id JOIN unit_schedules u ON u.weekday=w.weekday WHERE p.active=1`,
      )
      .all<{
        professionalId: string;
        weekday: number;
        startMinute: number;
        endMinute: number;
        breakStart: number | null;
        breakEnd: number | null;
      }>(),
    db
      .prepare(
        'SELECT professional_id as professionalId,start_at as startAt,end_at as endAt FROM schedule_blocks WHERE start_at < ? AND end_at > ?',
      )
      .bind(end, start)
      .all<{ professionalId: string | null; startAt: string; endAt: string }>(),
    db
      .prepare(
        'SELECT professional_id as professionalId,start_at as startAt,end_at as endAt,status,total_cents as totalCents FROM bookings WHERE start_at >= ? AND start_at < ?',
      )
      .bind(start, end)
      .all<{
        professionalId: string;
        startAt: string;
        endAt: string;
        status: string;
        totalCents: number;
      }>(),
  ]);
  let availableMinutes = 0,
    occupiedMinutes = 0;
  for (let day = 1; day <= lastDay; day++) {
    const date = `${month}-${String(day).padStart(2, '0')}`,
      weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
    for (const row of schedules.results.filter(
      (item) => item.weekday === weekday,
    )) {
      const ranges: Array<[number, number]> =
        row.breakStart !== null && row.breakEnd !== null
          ? [
              [row.startMinute, Math.min(row.endMinute, row.breakStart)],
              [Math.max(row.startMinute, row.breakEnd), row.endMinute],
            ]
          : [[row.startMinute, row.endMinute]];
      for (const [from, to] of ranges.filter(([a, b]) => b > a)) {
        const a = Date.parse(zonedDateTimeToUtcIso(date, from, timezone)),
          b =
            to === 1440
              ? a + (to - from) * 60000
              : Date.parse(zonedDateTimeToUtcIso(date, to, timezone));
        const clip = (s: string, e: string): Interval => [
          Math.max(a, Date.parse(s)),
          Math.min(b, Date.parse(e)),
        ];
        const blocked = blocks.results
          .filter(
            (item) =>
              !item.professionalId ||
              item.professionalId === row.professionalId,
          )
          .map((item) => clip(item.startAt, item.endAt));
        const busy = bookings.results
          .filter(
            (item) =>
              item.professionalId === row.professionalId &&
              ['pending', 'confirmed', 'completed', 'no_show'].includes(
                item.status,
              ),
          )
          .map((item) => clip(item.startAt, item.endAt));
        availableMinutes += (b - a) / 60000 - minutes(blocked);
        occupiedMinutes += minutes([...blocked, ...busy]) - minutes(blocked);
      }
    }
  }
  const rows = bookings.results;
  return {
    month,
    availableMinutes,
    occupiedMinutes,
    occupancyPercent:
      availableMinutes > 0
        ? Math.round((occupiedMinutes / availableMinutes) * 100)
        : 0,
    upcoming: rows.filter(
      (item) =>
        ['confirmed', 'pending'].includes(item.status) &&
        Date.parse(item.startAt) > Date.now(),
    ).length,
    cancelled: rows.filter((item) => item.status === 'cancelled').length,
    completed: rows.filter((item) => item.status === 'completed').length,
    noShows: rows.filter((item) => item.status === 'no_show').length,
    expectedValueCents: rows
      .filter((item) => ['pending', 'confirmed'].includes(item.status))
      .reduce((sum, item) => sum + item.totalCents, 0),
    completedServiceValueCents: rows
      .filter((item) => item.status === 'completed')
      .reduce((sum, item) => sum + item.totalCents, 0),
  };
}
