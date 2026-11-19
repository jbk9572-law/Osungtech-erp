import { getThemeFeatures } from "@/lib/erp-theme-config";

export type InvoiceFormChoice = "A" | "B" | "N";

// 명세표 인쇄 서식 고르기 — 주소의 ?form=n / a / b 가 있으면 그것(직원이 직접 고른 것)이 우선이고,
// 없을 때만 회사 테마의 기본 서식을 쓴다(클래식 = 기존 B형, grid-modern = 새 서식 N). 종이 서식 자체는 어느 쪽이든 그대로다.
export function resolveInvoiceForm(param: string | undefined, theme: string | null | undefined): InvoiceFormChoice {
  if (param === "n") return "N";
  if (param === "a") return "A";
  if (param === "b") return "B";
  return getThemeFeatures(theme).defaultInvoiceForm;
}

/** 서식 → 주소의 ?form= 값(인쇄 옵션 줄이 현재 선택을 표시할 때 쓴다). */
export function invoiceFormParam(form: InvoiceFormChoice): "n" | "a" | "b" {
  return form === "N" ? "n" : form === "A" ? "a" : "b";
}

/** 인쇄 옵션 줄의 "서식" 선택지 — 새 서식(공용)이 맨 앞, 엔택스 복제형은 그 뒤. */
export const INVOICE_FORM_OPTIONS = [
  { value: "n", label: "새 서식" },
  { value: "b", label: "B형" },
  { value: "a", label: "A형" },
];
