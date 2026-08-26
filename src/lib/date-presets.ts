import { nowInKst } from "@/lib/kst-date";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDays(d: Date, n: number) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

export type DatePreset = { label: string; from: string; to: string };

// 서버 컴포넌트에서 매 요청마다 "오늘" 기준으로 계산하는 조회기간 프리셋.
// 서버는 보통 UTC로 도는데 now.getFullYear() 등을 그대로 쓰면 한국
// 자정~오전 9시 사이엔 "오늘"이 아직 어제로 계산된다 — 한국 기준으로
// 고정해서 구한다.
export function getDatePresets(now: Date = new Date()): DatePreset[] {
  const kstNow = nowInKst(now);
  const today = new Date(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate());
  const dayOfWeek = today.getDay(); // 0=일요일
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const thisWeekStart = addDays(today, mondayOffset);
  const thisWeekEnd = addDays(thisWeekStart, 6);
  const lastWeekStart = addDays(thisWeekStart, -7);
  const lastWeekEnd = addDays(thisWeekEnd, -7);

  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const thisMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);

  const thisYearStart = new Date(today.getFullYear(), 0, 1);
  const thisYearEnd = new Date(today.getFullYear(), 11, 31);
  const lastYearStart = new Date(today.getFullYear() - 1, 0, 1);
  const lastYearEnd = new Date(today.getFullYear() - 1, 11, 31);

  return [
    { label: "오늘", from: toDateStr(today), to: toDateStr(today) },
    { label: "어제", from: toDateStr(addDays(today, -1)), to: toDateStr(addDays(today, -1)) },
    { label: "이번주", from: toDateStr(thisWeekStart), to: toDateStr(thisWeekEnd) },
    { label: "지난주", from: toDateStr(lastWeekStart), to: toDateStr(lastWeekEnd) },
    { label: "이번달", from: toDateStr(thisMonthStart), to: toDateStr(thisMonthEnd) },
    { label: "지난달", from: toDateStr(lastMonthStart), to: toDateStr(lastMonthEnd) },
    { label: "올해", from: toDateStr(thisYearStart), to: toDateStr(thisYearEnd) },
    { label: "작년", from: toDateStr(lastYearStart), to: toDateStr(lastYearEnd) },
  ];
}

// 매출/매입 목록의 기본 조회기간 하한 — 날짜를 직접 안 걸었으면 지난달
// 1일부터(=최근 2개월 가량)만 보여준다. 그보다 오래된 내역은 날짜 필터로
// 직접 조회한다.
export function previousMonthStart(now: Date = new Date()): string {
  const kstNow = nowInKst(now);
  const today = new Date(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate());
  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  return toDateStr(lastMonthStart);
}

// "YYYY-MM" 월 문자열 <-> 조회기간(from/to) 변환 헬퍼. 월별 리포트에서 사용.
export function currentMonth(now: Date = new Date()): string {
  const kstNow = nowInKst(now);
  return `${kstNow.getUTCFullYear()}-${pad(kstNow.getUTCMonth() + 1)}`;
}

export function getMonthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const from = new Date(y, m - 1, 1);
  const to = new Date(y, m, 0);
  return { from: toDateStr(from), to: toDateStr(to) };
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
