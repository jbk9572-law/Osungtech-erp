import type { CSSProperties } from "react";

// 관리번호/비고처럼 값이 없어 "-" 하나만 덩그러니 보여줄 때, 원래 텍스트
// 정렬(왼쪽) 그대로 두면 하이픈이 칸 왼쪽 끝에 붙어 어색해 보인다. 값이
// 없을 때만 가운데로 정렬하고, 실제 텍스트가 있으면 원래대로 왼쪽 정렬한다.
export function dashOrLeftAlign(hasValue: unknown): CSSProperties {
  return hasValue ? {} : { textAlign: "center" };
}
