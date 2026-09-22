export type LeaveUnit = "full" | "half_am" | "half_pm" | "quarter_am" | "quarter_pm";

// 반차/반반차는 하루만 신청 가능하고(폼에서 종료일을 시작일과 동일하게
// 고정), 사용 일수도 이 값으로 자동 채워진다 — 종일만 사용자가 직접
// 일수를 입력한다(여러 날짜에 걸친 신청이라 단순 곱셈으로 못 구함).
export const LEAVE_UNIT_DAYS: Record<Exclude<LeaveUnit, "full">, number> = {
  half_am: 0.5,
  half_pm: 0.5,
  quarter_am: 0.25,
  quarter_pm: 0.25,
};

export const LEAVE_UNIT_LABEL: Record<LeaveUnit, string> = {
  full: "종일",
  half_am: "오전반차",
  half_pm: "오후반차",
  quarter_am: "오전반반차",
  quarter_pm: "오후반반차",
};

export const LEAVE_UNIT_OPTIONS: LeaveUnit[] = ["full", "half_am", "half_pm", "quarter_am", "quarter_pm"];
