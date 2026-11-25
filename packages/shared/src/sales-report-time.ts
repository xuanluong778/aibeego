/** Khoảng ngày báo cáo bán hàng theo IANA timezone (mặc định Asia/Ho_Chi_Minh). Lưu truy vấn UTC. */

export const DEFAULT_SALES_REPORT_TIMEZONE = 'Asia/Ho_Chi_Minh';

export type SalesReportRangePreset = 'today' | '7d' | '30d' | 'month' | 'year' | 'custom';

export type ZonedRange = {
  preset: string;
  timeZone: string;
  /** Ngày bắt đầu (YYYY-MM-DD) theo timezone tổ chức */
  fromDate: string;
  /** Ngày kết thúc (YYYY-MM-DD) theo timezone tổ chức */
  toDate: string;
  fromUtc: Date;
  toUtc: Date;
};

function partsInTimeZone(d: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: timeZone || 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const map = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

function formatYmd(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** UTC instant khi đồng hồ địa phương (timeZone) là endHour:endMin:endSec trên lịch y-m-d. */
function zonedLocalToUtc(
  y: number,
  m: number,
  d: number,
  timeZone: string,
  endHour: number,
  endMin: number,
  endSec: number,
  ms: number,
): Date {
  const anchor = Date.UTC(y, m - 1, d, 12, 0, 0, 0);
  for (let delta = -16 * 60; delta <= 16 * 60; delta += 1) {
    const cand = new Date(anchor + delta * 60_000);
    const p = partsInTimeZone(cand, timeZone);
    if (p.year === y && p.month === m && p.day === d && p.hour === endHour && p.minute === endMin && p.second === endSec) {
      return new Date(cand.getTime() + ms);
    }
  }
  return new Date(Date.UTC(y, m - 1, d, endHour - 7, endMin, endSec, ms));
}

export function calendarDateInTimeZone(d: Date, timeZone: string): string {
  const p = partsInTimeZone(d, timeZone);
  return formatYmd(p.year, p.month, p.day);
}

export function addCalendarDays(ymd: string, days: number): string {
  const [ys, ms, ds] = ymd.split('-');
  const y = Number(ys);
  const m = Number(ms);
  const d = Number(ds);
  if (!y || !m || !d) throw new Error(`Invalid ymd: ${ymd}`);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return formatYmd(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function resolveSalesReportRange(opts: {
  preset?: string;
  from?: string;
  to?: string;
  timeZone?: string;
  now?: Date;
}): ZonedRange {
  const timeZone = opts.timeZone?.trim() || DEFAULT_SALES_REPORT_TIMEZONE;
  const now = opts.now ?? new Date();
  const today = calendarDateInTimeZone(now, timeZone);
  const preset = (opts.preset || '30d') as SalesReportRangePreset;

  if (preset === 'custom') {
    if (!opts.from?.trim() || !opts.to?.trim()) {
      throw new Error('Khoảng custom cần from và to (YYYY-MM-DD)');
    }
    const fromDate = opts.from.trim().slice(0, 10);
    const toDate = opts.to.trim().slice(0, 10);
    if (fromDate > toDate) throw new Error('from phải ≤ to');
    const fromParts = fromDate.split('-').map(Number);
    const toParts = toDate.split('-').map(Number);
    const [fy, fm, fd] = fromParts;
    const [ty, tm, td] = toParts;
    if ([fy, fm, fd, ty, tm, td].some((n) => !Number.isFinite(n))) {
      throw new Error('from/to phải là YYYY-MM-DD');
    }
    return {
      preset,
      timeZone,
      fromDate,
      toDate,
      fromUtc: zonedLocalToUtc(fy!, fm!, fd!, timeZone, 0, 0, 0, 0),
      toUtc: zonedLocalToUtc(ty!, tm!, td!, timeZone, 23, 59, 59, 999),
    };
  }

  let fromDate = today;
  let toDate = today;
  if (preset === '7d') fromDate = addCalendarDays(today, -6);
  else if (preset === '30d') fromDate = addCalendarDays(today, -29);
  else if (preset === 'month') {
    const p = partsInTimeZone(now, timeZone);
    fromDate = formatYmd(p.year, p.month, 1);
  } else if (preset === 'year') {
    const p = partsInTimeZone(now, timeZone);
    fromDate = formatYmd(p.year, 1, 1);
  }

  const fromParts = fromDate.split('-').map(Number);
  const toParts = toDate.split('-').map(Number);
  const [fy, fm, fd] = fromParts;
  const [ty, tm, td] = toParts;
  return {
    preset,
    timeZone,
    fromDate,
    toDate,
    fromUtc: zonedLocalToUtc(fy!, fm!, fd!, timeZone, 0, 0, 0, 0),
    toUtc: zonedLocalToUtc(ty!, tm!, td!, timeZone, 23, 59, 59, 999),
  };
}