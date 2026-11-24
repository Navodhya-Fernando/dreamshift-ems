export type Cadence = 'DAILY' | 'WEEKDAYS' | 'WEEKLY' | 'MONTHLY';
export function nextOccurrence(date: Date, cadence: Cadence, anchorDay: number): Date {
  const next = new Date(date);
  if (cadence === 'WEEKDAYS') {
    do { next.setUTCDate(next.getUTCDate()+1); } while ([0,6].includes(next.getUTCDay()));
    return next;
  }
  if (cadence === 'DAILY' || cadence === 'WEEKLY') {
    next.setUTCDate(next.getUTCDate() + (cadence === 'DAILY' ? 1 : 7));
    return next;
  }
  next.setUTCDate(1);
  next.setUTCMonth(next.getUTCMonth()+1);
  const last = new Date(Date.UTC(next.getUTCFullYear(),next.getUTCMonth()+1,0)).getUTCDate();
  next.setUTCDate(Math.min(anchorDay,last));
  return next;
}
export function utcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate()));
}
export function dueOccurrences(first: Date, cadence: Cadence, anchorDay: number, today: Date, limit = 3) {
  const dates: Date[] = [];
  let next = new Date(first);
  while (next <= today && dates.length < limit) {
    dates.push(next);
    next = nextOccurrence(next,cadence,anchorDay);
  }
  return { dates, next };
}
