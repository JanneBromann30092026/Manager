/**
 * Calendar export (RFC 5545) for the iPad calendar, taken from Kompass: all-day events with a
 * reminder. Only plan tasks go in – no numbers, no secrets.
 */

export interface IcsEvent {
  /** Unique and stable, e.g. the plan item id. */
  uid: string;
  /** All-day date "JJJJ-MM-TT". */
  date: string;
  summary: string;
  description?: string;
}

export interface IcsOptions {
  /** Text of the reminder alarm. */
  alarm: string;
  /**
   * Alarm relative to the start of the day in hours (all-day events start at 00:00):
   * 9 = 9:00 the same day, -15 = 9:00 the day before.
   */
  alarmHours?: number;
}

/** Escapes text values (backslash, semicolon, comma, line breaks). */
export function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

const encoder = new TextEncoder();

/** Folds a content line to at most 75 octets per line without splitting a character. */
export function foldLine(line: string): string {
  const parts: string[] = [];
  let current = '';
  let size = 0;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    // Continuation lines start with a space, which counts towards the 75 octets.
    const limit = parts.length === 0 ? 75 : 74;
    if (size + bytes > limit) {
      parts.push(current);
      current = '';
      size = 0;
    }
    current += char;
    size += bytes;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

const compactDate = (date: string) => date.replace(/-/g, '');

function nextDay(date: string): string {
  const [y = 1970, m = 1, d = 1] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

function stamp(now: Date): string {
  return `${now.toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`;
}

function trigger(hours: number): string {
  return `${hours < 0 ? '-' : ''}PT${Math.abs(hours)}H`;
}

export function buildIcs(events: readonly IcsEvent[], now: Date, options: IcsOptions): string {
  const hours = options.alarmHours ?? 9;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Manager//Wochenplan//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];
  for (const event of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${event.uid}@manager`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART;VALUE=DATE:${compactDate(event.date)}`,
      `DTEND;VALUE=DATE:${compactDate(nextDay(event.date))}`,
      `SUMMARY:${escapeText(event.summary)}`,
      ...(event.description ? [`DESCRIPTION:${escapeText(event.description)}`] : []),
      'TRANSP:TRANSPARENT',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeText(options.alarm)}`,
      `TRIGGER:${trigger(hours)}`,
      'END:VALARM',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return `${lines.map(foldLine).join('\r\n')}\r\n`;
}
