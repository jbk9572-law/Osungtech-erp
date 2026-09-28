// 근로소득 간이세액표 조회 — 월급여 구간 × 부양가족수(1~11명) 조합에서
// 세액을 그대로 찾아온다(계산식이 아니라 국세청 고시 조회표라서 %로
// 못 구한다). 표 자체는 withholding_tax_brackets 테이블에 관리자가
// 직접 입력/업로드해둔 값이고, 이 함수는 순수 조회 로직만 갖는다 —
// DB 없이도 테스트 가능하게 프레임워크 의존 없이 뺐다.
export type WithholdingTaxBracket = {
  salary_from: number;
  salary_to: number | null;
  dependents_1: number;
  dependents_2: number;
  dependents_3: number;
  dependents_4: number;
  dependents_5: number;
  dependents_6: number;
  dependents_7: number;
  dependents_8: number;
  dependents_9: number;
  dependents_10: number;
  dependents_11: number;
};

const DEPENDENTS_COLUMN = [
  "dependents_1",
  "dependents_2",
  "dependents_3",
  "dependents_4",
  "dependents_5",
  "dependents_6",
  "dependents_7",
  "dependents_8",
  "dependents_9",
  "dependents_10",
  "dependents_11",
] as const;

// salary_from 이상 salary_to 미만인 구간을 찾는다. salary_to가 null인
// 구간(표의 맨 마지막 "그 이상" 구간)은 상한 없이 매칭된다. 부양가족
// 수가 11명을 초과하면 표에 있는 마지막 칸(11명)을 그대로 쓴다 — 실제
// 표는 11명 초과분마다 별도 차감식이 있지만 소규모 회사에서 사실상
// 발생하지 않는 극단값이라 이 앱의 범위에서는 11명 기준으로 단순화한다.
export function lookupIncomeTax(
  brackets: WithholdingTaxBracket[],
  monthlySalary: number,
  dependentsCount: number,
): number {
  const bracket = brackets.find(
    (b) => monthlySalary >= b.salary_from && (b.salary_to === null || monthlySalary < b.salary_to),
  );
  if (!bracket) return 0;
  const columnIndex = Math.min(Math.max(dependentsCount, 1), 11) - 1;
  return Number(bracket[DEPENDENTS_COLUMN[columnIndex]]);
}

// 지방소득세는 소득세의 10%, 원단위 반올림(국세청 실무의 "10원 미만
// 절사"까지는 반영하지 않는 단순화 — payroll/page.tsx PageGuide에
// 명시).
export function calcLocalIncomeTax(incomeTax: number): number {
  return Math.round(incomeTax * 0.1);
}
