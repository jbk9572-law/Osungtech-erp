// 매출/매입 공통 — 과세구분(tax_type)/증빙유형(evidence_type).
// 00000000000119_sales_tax_and_evidence_fields.sql에서 두 테이블(sales_orders/
// purchase_orders)에 똑같이 컬럼을 만들어뒀지만, 그동안 입력 화면이 없어서
// tax_type은 항상 기본값 '과세'로, evidence_type은 항상 null로 고정돼
// 있었다(화면엔 표시만 되고 실제로 채워지지 않는 반쪽짜리 기능). 매출/매입
// 신규·수정 폼에서 같이 입력받게 하고, 세금계산서 발행 화면도 이 값을
// 보고 동작을 맞춘다.
export const TAX_TYPES = ["과세", "면세", "영세"] as const;
export type TaxType = (typeof TAX_TYPES)[number];

// "샘플증정"은 매출 전용 — 무상증정(재고만 차감, 매출/세액 없음) 건에
// new-sale-form이 "샘플(무상증정)" 체크박스를 켰을 때 자동으로 넣는다.
// null/"세금계산서"가 아닌 값은 전부 canIssueTaxInvoice()에서 걸러지므로
// 세금계산서 발행 대상·일괄작성 목록에 자동으로 빠진다(별도 분기 불필요).
export const EVIDENCE_TYPES = ["세금계산서", "계산서", "현금영수증", "카드매출전표", "샘플증정"] as const;
export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

// 세금계산서를 발행해도 되는 조건 — evidence_type이 이미 다른 증빙(현금
// 영수증/카드매출전표/계산서)으로 정해졌으면, 그 증빙이 세금계산서를
// 대신하므로 발행 대상이 아니다. evidence_type이 비어있거나 "세금계산서"로
// 정해진 경우만 허용한다.
export function canIssueTaxInvoice(evidenceType: string | null): boolean {
  return evidenceType === null || evidenceType === "세금계산서";
}

// 과세구분 "면세"는 세금계산서가 아니라 계산서(부가세 없는 별도 문서,
// 아직 이 ERP에 발행 기능 없음)를 받는 거래라 세금계산서 발행 대상에서
// 완전히 제외한다.
export function isTaxExempt(taxType: string): boolean {
  return taxType === "면세";
}

// 세금계산서 작성 화면의 종류(invoice_type) 기본값 — 과세구분과 1:1로
// 맞춘다(과세→일반, 영세→영세율). 면세는 isTaxExempt()에서 이미 걸러진다.
export function defaultInvoiceTypeFromTaxType(taxType: string): "general" | "zero_rate" {
  return taxType === "영세" ? "zero_rate" : "general";
}
