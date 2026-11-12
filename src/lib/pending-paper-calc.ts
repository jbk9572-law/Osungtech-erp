// 매출/매입 등록 폼이 "임시 저장된 모조지 계산 + 할일에서 가져온 계산들"을 합쳐서
// TG0(모조지) 줄을 등록 전에 미리 보여줄 때 쓰는 순수 계산. 두 폼(new-sale-form /
// new-purchase-form)이 글자 그대로 똑같이 들고 있던 로직을 한 곳으로 모았다.
// useMemo/useState는 각 폼에 그대로 두고(리액트 컴파일러 린트 영향을 안 받도록), 계산만 여기서 한다.

import {
  formatPaperCalcSizeLines,
  mergePaperCalcInputItems,
  type PaperCalcSizeRow,
} from "@/lib/paper-calc-summary";

// 임시 저장된 계산(JSON 문자열)과 가져온 계산들의 연수/원지 합계. 합계 연수가 0 이하면 null.
export function summarizePendingPaperCalc(
  pendingPaperCalc: string | null,
  copiedPaperCalcs: { totalSheet: number; totalPaper: number }[],
): { totalSheet: number; totalPaper: number } | null {
  let totalSheet = 0;
  let totalPaper = 0;
  if (pendingPaperCalc) {
    try {
      const parsed = JSON.parse(pendingPaperCalc) as { totalSheet: number; totalPaper: number };
      totalSheet += parsed.totalSheet;
      totalPaper += parsed.totalPaper;
    } catch {
      // 잘못된 값이면 이 부분은 0으로 취급
    }
  }
  for (const calc of copiedPaperCalcs) {
    totalSheet += calc.totalSheet;
    totalPaper += calc.totalPaper;
  }
  return totalSheet > 0 ? { totalSheet, totalPaper } : null;
}

// 계산에 들어간 사이즈별 수량을 한 줄씩 보여주기 위한 줄 목록(참고용, 수량/단가에는 안 센다).
export function pendingPaperCalcSizeLines(
  pendingPaperCalc: string | null,
  copiedPaperCalcs: { inputItems: unknown }[],
): string[] {
  let sizes: PaperCalcSizeRow[] = [];
  if (pendingPaperCalc) {
    try {
      const parsed = JSON.parse(pendingPaperCalc) as { inputItems?: unknown };
      sizes = mergePaperCalcInputItems(sizes, parsed.inputItems);
    } catch {
      // 무시
    }
  }
  for (const calc of copiedPaperCalcs) {
    sizes = mergePaperCalcInputItems(sizes, calc.inputItems);
  }
  return formatPaperCalcSizeLines(sizes);
}

// 자동 계산 연수와 사용자가 고친 수량(override)을 합쳐 실제로 들어갈 TG0 수량을 정한다.
// override가 null이면 자동값 그대로. 계산이 없으면(summary null) 수량 0.
export function resolveTg0Quantity(
  summary: { totalSheet: number } | null,
  override: number | null,
): { quantity: number; isOverridden: boolean } {
  if (!summary) return { quantity: 0, isOverridden: false };
  return {
    quantity: override ?? summary.totalSheet,
    isOverridden: override !== null && override !== summary.totalSheet,
  };
}
