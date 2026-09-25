// 주 52시간(근로기준법상 연장근로 한도를 포함한 주 최대 근로시간) 초과 여부를
// 판단하기 위한 순수 계산 — attendance_records의 출퇴근 시각만으로 이번 주
// 실제 근무시간을 더한다(휴게시간 차감 필드가 아직 없어 그대로 합산한다).
// DB 접근이 없는 순수 함수라 weekly-hours.test.ts에서 주 경계(월요일 시작)와
// 색 등급 경계값을 DB 없이 고정해둘 수 있다.

// 실제 초과(빨강)는 52시간이 기준이고, 그 전에 미리 관리자가 알아챌 수 있게
// 여유를 둔 경고(노랑) 문턱은 48시간으로 잡는다 — 회사마다 다른 값을 원할 수
// 있지만, 이번 1차 구현은 설정 화면 없이 법정 기준에 맞춘 고정값만 지원한다.
export const WEEKLY_HOURS_WARNING = 48;
export const WEEKLY_HOURS_LIMIT = 52;

export type HoursTone = "ok" | "warn" | "danger";

export function weeklyHoursTone(hours: number): HoursTone {
  if (hours > WEEKLY_HOURS_LIMIT) return "danger";
  if (hours >= WEEKLY_HOURS_WARNING) return "warn";
  return "ok";
}

// dateStr(KST 기준 YYYY-MM-DD)이 속한 주의 월요일~일요일 범위. 근로기준법상
// "1주"는 특별한 정함이 없으면 통상 월요일부터 계산한다.
export function getWeekRange(dateStr: string): { start: string; end: string } {
  const [y, m, d] = dateStr.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  // getUTCDay(): 일요일=0 ~ 토요일=6. 월요일을 주의 시작으로 맞추려면
  // 일요일만 6일 전으로, 나머지는 (day-1)일 전으로 당긴다.
  const day = utc.getUTCDay();
  const diffToMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(utc);
  monday.setUTCDate(utc.getUTCDate() - diffToMonday);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);

  const fmt = (dt: Date) =>
    `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
  return { start: fmt(monday), end: fmt(sunday) };
}

// 출퇴근이 둘 다 찍힌 기록만 더한다 — 아직 근무 중(퇴근 전)인 기록은 그
// 시점까지 얼마나 일했는지 애매해서 빼고, 완결된 기록만으로 "이번 주 누적"을
// 보여준다.
export function sumWorkedHours(records: { clock_in_at: string | null; clock_out_at: string | null }[]): number {
  let minutes = 0;
  for (const r of records) {
    if (!r.clock_in_at || !r.clock_out_at) continue;
    const diffMs = new Date(r.clock_out_at).getTime() - new Date(r.clock_in_at).getTime();
    if (diffMs > 0) minutes += diffMs / 60000;
  }
  return Math.round((minutes / 60) * 10) / 10;
}
