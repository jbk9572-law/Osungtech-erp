// 근로기준법 60조 기준 연차 자동 계산 + 61조 사용촉진 제도(6개월전/2개월전
// 통지) 날짜 계산. 순수 함수로 둬서(leave-accrual.test.ts) DB 없이도 날짜
// 경계(1년차→2년차, 3년차 가산 등)를 바로 검증할 수 있게 한다.
//
// 입사일 기준(회사 자체 회계연도 기준 통일 지급 방식은 지원하지 않음)으로만
// 계산한다 — 회계연도 기준은 근로자에게 불리하지 않아야 한다는 별도 비교
// 규정이 있어 계산이 한 단계 더 필요한데, 입사일 기준이 항상 법정 최소
// 기준을 정확히 만족하는 더 단순하고 안전한 방식이라 1차로 이것만 지원한다.

type YMD = { y: number; m: number; d: number };

function parseYmd(dateStr: string): YMD {
  const [y, m, d] = dateStr.split("-").map(Number);
  return { y, m, d };
}

function formatYmd({ y, m, d }: YMD): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${y}-${pad(m)}-${pad(d)}`;
}

// 달력상 "몇 년 뒤 같은 월/일"을 구한다 — 2/29 입사자가 평년에 걸리면
// 2/28로 당겨진다(JS Date의 자연스러운 말일 보정과 동일하게 UTC로 계산).
function addYearsYmd(ymd: YMD, years: number): YMD {
  const utc = new Date(Date.UTC(ymd.y + years, ymd.m - 1, ymd.d));
  return { y: utc.getUTCFullYear(), m: utc.getUTCMonth() + 1, d: utc.getUTCDate() };
}

function addMonthsYmd(ymd: YMD, months: number): YMD {
  const utc = new Date(Date.UTC(ymd.y, ymd.m - 1 + months, ymd.d));
  return { y: utc.getUTCFullYear(), m: utc.getUTCMonth() + 1, d: utc.getUTCDate() };
}

function compareYmd(a: YMD, b: YMD): number {
  if (a.y !== b.y) return a.y - b.y;
  if (a.m !== b.m) return a.m - b.m;
  return a.d - b.d;
}

// asOf 시점 기준 만 근속연수(입사기념일을 아직 안 지났으면 그 전 해까지만
// 센다) — 0 이상, asOf가 입사일보다 이전이면 0으로 취급한다.
function fullServiceYears(hire: YMD, asOf: YMD): number {
  if (compareYmd(asOf, hire) <= 0) return 0;
  let years = asOf.y - hire.y;
  if (asOf.m < hire.m || (asOf.m === hire.m && asOf.d < hire.d)) years -= 1;
  return Math.max(0, years);
}

// asOf 시점 기준 만 근속개월수(1년 미만자의 매월 개근 월차 계산용) — 최대
// 11로 자른다. 근로기준법상 1년 미만자는 입사 후 1개월 개근마다 1일씩,
// 최대 11일까지 발생한다.
function fullServiceMonthsCapped(hire: YMD, asOf: YMD, cap: number): number {
  if (compareYmd(asOf, hire) <= 0) return 0;
  let months = (asOf.y - hire.y) * 12 + (asOf.m - hire.m);
  if (asOf.d < hire.d) months -= 1;
  return Math.min(cap, Math.max(0, months));
}

// 법정 연차 일수 — asOf 시점까지 발생이 확정된 값(이미 지난 개월/연차만
// 센다, 앞으로 발생 예정인 건 포함하지 않는다).
//   · 1년 미만: 개근 월 1일씩, 최대 11일
//   · 1년 이상: 기본 15일 + (근속 3년째부터 매 2년마다 1일 가산), 25일 한도
export function calcStatutoryAnnualLeaveDays(hireDateStr: string, asOfDateStr: string): number {
  const hire = parseYmd(hireDateStr);
  const asOf = parseYmd(asOfDateStr);
  const years = fullServiceYears(hire, asOf);

  if (years < 1) {
    return fullServiceMonthsCapped(hire, asOf, 11);
  }

  const extra = Math.floor((years - 1) / 2);
  return Math.min(25, 15 + extra);
}

// 지금 쌓이고 있는 연차가 "언제까지 써야 하는지"(입사기념일 기준 1년 단위
// 부여이므로, asOf 다음으로 맞는 입사기념일이 곧 사용기한이다).
export function nextLeaveExpiryDate(hireDateStr: string, asOfDateStr: string): string {
  const hire = parseYmd(hireDateStr);
  const asOf = parseYmd(asOfDateStr);
  const years = fullServiceYears(hire, asOf);
  return formatYmd(addYearsYmd(hire, years + 1));
}

export type LeavePromotionWindow = {
  expiryDate: string;
  firstNoticeDate: string; // 사용기한 6개월 전
  secondNoticeDate: string; // 사용기한 2개월 전
};

export function leavePromotionWindow(hireDateStr: string, asOfDateStr: string): LeavePromotionWindow {
  const expiryDate = nextLeaveExpiryDate(hireDateStr, asOfDateStr);
  const expiry = parseYmd(expiryDate);
  return {
    expiryDate,
    firstNoticeDate: formatYmd(addMonthsYmd(expiry, -6)),
    secondNoticeDate: formatYmd(addMonthsYmd(expiry, -2)),
  };
}
