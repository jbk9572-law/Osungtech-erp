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
export function getDatePresets(now: Date = new Date()): DatePreset[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
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
