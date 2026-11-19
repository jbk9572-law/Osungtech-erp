import { getThemeFeatures } from "@/lib/erp-theme-config";

export type InvoiceFormChoice = "A" | "B";

// 명세표 인쇄 서식 고르기 — 주소의 ?form=a / ?form=b 가 있으면 그것(직원이 직접 고른 것)이 우선이고,
// 없을 때만 회사 테마의 기본 서식을 쓴다(클래식 = 기존 B형, grid-modern = 새 A형). 종이 서식 자체는 어느 쪽이든 그대로다.
export function resolveInvoiceForm(param: string | undefined, theme: string | null | undefined): InvoiceFormChoice {
  if (param === "a") return "A";
  if (param === "b") return "B";
  return getThemeFeatures(theme).defaultInvoiceForm;
}
