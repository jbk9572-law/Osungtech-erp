// 표에서 드래그로 고른 칸들의 숫자 합계 — 하단 상태바 "선택한 셀 N개 · 합계 · 평균"용 순수 계산.
// 화면에 보이는 글자 그대로 읽는다(천단위 쉼표·공백·"원" 허용, 마이너스 허용). 숫자가 아닌 칸은 건너뛴다.
export type GridSelectionSummary = { count: number; sum: number; average: number };

const NUMBER_RE = /^[-+]?\d+(\.\d+)?$/;

export function parseCellNumber(text: string): number | null {
  const cleaned = text.replace(/[,\s원]/g, "").replace(/^[△▽]/, "-");
  if (!NUMBER_RE.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** 숫자 칸이 2개 미만이면 null(한 칸 클릭·글자 선택은 합계를 보여줄 일이 아니다). */
export function summarizeCells(texts: string[]): GridSelectionSummary | null {
  const numbers = texts.map(parseCellNumber).filter((n): n is number => n !== null);
  if (numbers.length < 2) return null;
  // 소수 합계의 부동소수 잡음(0.1+0.2)을 둘째 자리에서 정리한다.
  const sum = Math.round(numbers.reduce((a, b) => a + b, 0) * 100) / 100;
  return { count: numbers.length, sum, average: Math.round((sum / numbers.length) * 100) / 100 };
}
