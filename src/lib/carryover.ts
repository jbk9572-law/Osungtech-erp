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

// 이월 건 전용 축약 날짜("MM.DD", 연도 생략) — "전월 이월분" 구간은 구간
// 제목에 이미 "전월(10월)"이라고 적혀 있어 각 행마다 연도까지 반복하면
// 중복이고, 옆에 "이월" 배지까지 붙으면 일반 행보다 칸이 넓어져 표가
// 들쭉날쭉해 보인다(사용자 지적). 일반 행의 날짜 표기(toLocaleDateString)는
// 그대로 둔다 — 이월 전용 구간에서만 쓴다.
export function formatCarryoverDate(dateStr: string): string {
  const match = /^\d{4}-(\d{2})-(\d{2})$/.exec(dateStr);
  return match ? `${match[1]}.${match[2]}` : dateStr;
}
