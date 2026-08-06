// 사용카드에 따라 문서 제목이 달라진다 — 개인카드로 쓴 문서는 "지급결의양식",
// 법인카드(하나/신한)로 쓴 문서는 "사용내역 (카드명)"으로 표시한다. 목록/
// 상세/인쇄 화면이 전부 이 규칙을 공유해야 문서 종류가 어디서나 똑같이
// 보인다.
export const PAYMENT_REQUEST_CARD_TYPES = ["개인카드", "하나법인카드", "신한법인카드"] as const;
export type PaymentRequestCardType = (typeof PAYMENT_REQUEST_CARD_TYPES)[number];

export function paymentRequestDocTitle(cardType: string | null): string {
  if (!cardType || cardType === "개인카드") return "지급결의양식";
  return `사용내역 (${cardType})`;
}
