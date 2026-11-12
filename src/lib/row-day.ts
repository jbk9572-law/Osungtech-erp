import { todayKstStr } from "@/lib/kst-date";

// 목록 그리드(매출/매입/포털 주문)에서 행의 날짜가 "오늘"인지, 며칠 뒤로
// 미리 등록해둔 "예약"인지 구분하는 공용 헬퍼. 이월건이 맨 위에 고정되고
// 미래 날짜 전표도 섞여 있어서 날짜 글자만으로는 오늘 것을 찾기 어렵다는
// 요청으로 만들었다. 기준일은 서버/브라우저 타임존과 무관하게 한국(KST)
// 날짜다.
export type RowDay = "today" | "future" | null;

export function rowDay(date: string | null | undefined, today: string = todayKstStr()): RowDay {
  if (!date) return null;
  const d = date.slice(0, 10);
  if (d === today) return "today";
  if (d > today) return "future";
  return null;
}

// <tr>/카드의 className에 덧붙이는 용도. 색은 erp-theme.css의 .day-today /
// .day-future가 토큰으로만 칠한다.
export function rowDayClass(day: RowDay): string {
  return day ? ` day-${day}` : "";
}
