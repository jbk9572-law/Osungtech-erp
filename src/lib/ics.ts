import type { CalendarItem } from "@/lib/calendar-data";

// RFC 5545(iCalendar) TEXT 값 이스케이프 — 콤마/세미콜론/백슬래시/개행을
// 그대로 두면 외부 캘린더 앱이 값을 여러 필드로 잘못 쪼개 읽는다.
function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function formatIcsDateTimeUtc(iso: string): string {
  const d = new Date(iso);
  return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

// 종일 일정은 날짜만 담는다(VALUE=DATE). RFC 5545에서 DTEND는 배타적
// (exclusive) 끝이라, "9/22~9/23 이틀간 종일"이면 DTEND는 9/24가 되어야
// 캘린더 앱이 9/23까지 칠해준다 — endAt(그날 23:59:59)에 하루를 더한 날짜를
// 쓴다.
function formatIcsDateOnly(iso: string, addDay: boolean): string {
  const d = new Date(iso);
  if (addDay) d.setUTCDate(d.getUTCDate() + 1);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

// 월간 화면(getCalendarItems)이 만든 항목을 그대로 ICS(iCalendar) 문서로
// 옮긴다 — 화면과 구독 피드가 같은 소스 함수를 쓰므로 여기서는 형식 변환만
// 한다.
export function buildIcsFeed(items: CalendarItem[], calendarName: string): string {
  const now = formatIcsDateTimeUtc(new Date().toISOString());
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ELVONIX ERP//Calendar Feed//KO",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];

  for (const item of items) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${item.id}@elvonix-erp`);
    lines.push(`DTSTAMP:${now}`);
    if (item.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${formatIcsDateOnly(item.startAt, false)}`);
      lines.push(`DTEND;VALUE=DATE:${formatIcsDateOnly(item.endAt, true)}`);
    } else {
      lines.push(`DTSTART:${formatIcsDateTimeUtc(item.startAt)}`);
      lines.push(`DTEND:${formatIcsDateTimeUtc(item.endAt)}`);
    }
    lines.push(`SUMMARY:${escapeIcsText(item.title)}`);
    if (item.description) lines.push(`DESCRIPTION:${escapeIcsText(item.description)}`);
    if (item.location) lines.push(`LOCATION:${escapeIcsText(item.location)}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
