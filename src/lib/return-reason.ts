// 반품 사유를 자유 텍스트 대신 표준 코드로 고르게 한다 — 나중에
// 월별리포트에서 "어떤 사유가 반복되는지" 통계를 내려면 값이 일정한
// 집합이어야 한다. delivery-method.ts와 같은 방식(고정 배열, DB엔
// 그 라벨 문자열 그대로 저장)을 그대로 따른다.
export const RETURN_REASONS = [
  "오배송",
  "파손/불량",
  "수량 착오",
  "단순변심",
  "기타",
] as const;

export type ReturnReason = (typeof RETURN_REASONS)[number];
