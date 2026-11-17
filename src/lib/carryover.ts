import { todayKstStr } from "@/lib/kst-date";

// 이월(carryover) 공용 유틸.
//
// 거래일자(order_date/purchase_date)는 항상 실제 처리일 그대로 저장하고,
// "회계상 어느 달 실적으로 잡을지"는 is_carryover 플래그로 따로 표현한다.
// is_carryover가 true면 거래일자가 속한 달의 "다음 달"이 실적월이 된다.

// "YYYY-MM-DD" 문자열의 달을 그대로 문자열 연산으로 1 올린다 — Date 객체로
// 바꾸면 로컬 타임존에 따라 하루가 밀릴 수 있어(자정 근처), 순수 문자열
// 파싱만으로 계산한다.
export function nextMonthOf(dateStr: string): { year: number; month: number } | null {
  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(dateStr);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
}

// 등록 폼의 "N월 실적으로 이월" 체크박스 라벨용.
export function nextMonthLabel(dateStr: string): string {
  const next = nextMonthOf(dateStr);
  return next ? `${next.month}월` : "다음달";
}

// order_date/purchase_date와 is_carryover로부터 "YYYY-MM" 실적월을 구한다.
// 리포트/대시보드가 raw 날짜 대신 이 값으로 월별 구간을 판단해야, 예전
// 방식(거래일자 자체를 미래로 입력)과 숫자가 어긋나지 않는다.
export function effectiveMonth(dateStr: string, isCarryover: boolean): string {
  if (!isCarryover) return dateStr.slice(0, 7);
  const next = nextMonthOf(dateStr);
  if (!next) return dateStr.slice(0, 7);
  return `${next.year}-${String(next.month).padStart(2, "0")}`;
}

// from/to가 정확히 "그 달 1일~말일" 전체 범위일 때만 그 "YYYY-MM"을
// 돌려주고, 아니면 null — 매출/매입 목록은 이번달뿐 아니라 임의 기간
// (지난주, 직접 입력한 날짜 범위 등)도 조회할 수 있는데, "전월 이월분"은
// 정확히 "한 달 전체"를 보고 있을 때만 의미가 있다(임의 기간엔 "전월"이란
// 개념 자체가 없다). 목록 화면이 "전월 이월분" 구간을 추가로 보여줄지
// 판단하는 데 쓴다.
export function monthRangeOf(from: string, to: string): string | null {
  const match = /^(\d{4})-(\d{2})-01$/.exec(from);
  if (!match) return null;
  const [, yearStr, monthStr] = match;
  const lastDay = new Date(Number(yearStr), Number(monthStr), 0).getDate();
  const expectedTo = `${yearStr}-${monthStr}-${String(lastDay).padStart(2, "0")}`;
  return to === expectedTo ? `${yearStr}-${monthStr}` : null;
}

// ── 이월건 날짜 표기 규칙(매출/매입 목록 표·모바일 카드 공통, 이 함수 한 곳에서만 정한다) ─────────────
//  1) 날짜 칸에는 항상 "실제 거래일"을 쓴다. 이월이라고 실적월로 바꿔 쓰지 않는다(거래일자는 처리한 날 그대로 저장돼 있다).
//  2) 뱃지가 붙는 행(이월·예약)은 "MM.DD"로 짧게 쓴다 — 날짜 칸이 좁아(92px) 긴 날짜에 뱃지까지 붙으면 줄이 깨진다.
//     올해가 아니면 "YY.MM.DD"로 연도 두 자리를 붙여 헷갈리지 않게 한다(예: 1월에 보는 전월이월분의 "25.12.30").
//  3) 뱃지가 없는 일반 행은 지금처럼 "YYYY. MM. DD."를 그대로 쓴다.
//  4) 이월 종류와 실적월은 날짜가 아니라 뱃지("이월", 색으로 종류 구분, 툴팁에 "N월 실적")로만 표시한다.
export function formatCarryoverDate(dateStr: string, todayStr: string = todayKstStr()): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) return dateStr;
  const [, year, month, day] = match;
  return year === todayStr.slice(0, 4) ? `${month}.${day}` : `${year.slice(2)}.${month}.${day}`;
}

// 이 행이 뱃지(이월/예약)를 달고 있어 짧은 날짜(규칙 2)를 써야 하는지 — 표와 모바일 카드가 같은 판단을 쓴다.
export function usesShortDate(opts: { compactSection: boolean; isCarryover: boolean | undefined; isFuture: boolean }): boolean {
  return opts.compactSection || !!opts.isCarryover || opts.isFuture;
}

// 목록 행(<tr>/카드)의 이월 색 구분용 className — 두 종류를 다른 색으로 보여 준다:
//  · 전월 이월(이번 달 실적으로 넘어온 건, "전월 이월분" 구간의 행) → row-carryover (호박색)
//  · 익월이월(이번 달에 등록했지만 다음 달 실적으로 넘기는 건, 목록 안의 행) → row-carryover-next (연보라)
// 매출/매입 목록 표와 모바일 카드가 같은 규칙을 쓰도록 한 곳에서 정한다.
export function carryoverRowClass(isCarryover: boolean | undefined, inPrevMonthSection: boolean): string {
  if (!isCarryover) return "";
  return inPrevMonthSection ? " row-carryover" : " row-carryover-next";
}
