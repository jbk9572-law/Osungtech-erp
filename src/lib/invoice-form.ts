import { getThemeFeatures } from "@/lib/erp-theme-config";

export type InvoiceFormChoice = "A" | "B" | "N" | "NB";

/** 이 회사가 어떤 서식을 쓸 수 있는지 가르는 값 — 테마(tenants.theme)와 회사 식별자(tenants.slug). */
export type InvoiceScope = { theme: string | null | undefined; slug: string | null | undefined };

// 엔택스 복제형(A·B형)은 엔택스 서식을 쓰는 회사(지금은 오성테크)에만 보인다. 다른 회사는 전부 엘보닉스 A·B형이 기본이고, 엔택스 서식은 선택지로도 나오지 않는다.
// 새 회사가 엔택스 서식을 쓰게 되면 이 목록에만 slug를 추가한다.
export const ENTAX_FORM_TENANT_SLUGS: readonly string[] = ["osungtech"];

const FORM_LABEL: Record<InvoiceFormChoice, string> = { N: "엘보닉스 A형", NB: "엘보닉스 B형", B: "엔택스 B형", A: "엔택스 A형" };
const FORM_PARAM: Record<InvoiceFormChoice, "n" | "nb" | "a" | "b"> = { N: "n", NB: "nb", B: "b", A: "a" };

/**
 * 이 회사가 쓸 수 있는 서식 목록(선택지 순서).
 * - 오성테크(엔택스 서식을 쓰는 회사) 외 모든 회사: 엘보닉스 A형·B형(둘 다 2연식·전지) — 테마와 무관하게 기본
 * - 오성테크: 모던 그리드면 엘보닉스 A·B형 + 엔택스 B·A형, 클래식이면 엔택스 B·A형(예전 그대로)
 */
export function availableInvoiceForms(scope: InvoiceScope): InvoiceFormChoice[] {
  const isEntaxTenant = !!scope.slug && ENTAX_FORM_TENANT_SLUGS.includes(scope.slug);
  if (!isEntaxTenant) return ["N", "NB"];
  return getThemeFeatures(scope.theme).defaultInvoiceForm === "N" ? ["N", "NB", "B", "A"] : ["B", "A"];
}

// 명세표 인쇄 서식 고르기 — 주소의 ?form=n / a / b 가 이 회사가 쓸 수 있는 서식이면 그것(직원이 직접 고른 것)이 우선이고,
// 아니면 회사 테마의 기본 서식(클래식 = B형, 오성테크 외 전부·grid-modern = 엘보닉스 A형), 그것도 못 쓰면 쓸 수 있는 첫 서식.
export function resolveInvoiceForm(param: string | undefined, scope: InvoiceScope): InvoiceFormChoice {
  const available = availableInvoiceForms(scope);
  const asked = (Object.keys(FORM_PARAM) as InvoiceFormChoice[]).find((f) => FORM_PARAM[f] === param);
  if (asked && available.includes(asked)) return asked;
  const themeDefault = getThemeFeatures(scope.theme).defaultInvoiceForm;
  return available.includes(themeDefault) ? themeDefault : available[0];
}

/** 서식 → 주소의 ?form= 값(인쇄 옵션 줄이 현재 선택을 표시할 때 쓴다). */
export function invoiceFormParam(form: InvoiceFormChoice): "n" | "nb" | "a" | "b" {
  return FORM_PARAM[form];
}

/** 인쇄 옵션 줄의 "서식" 묶음 — 이 회사가 고를 수 있는 서식이 둘 이상일 때만 나온다(하나뿐이면 고를 게 없으니 줄 자체를 감춘다). */
export function invoiceFormOptionGroup(form: InvoiceFormChoice, scope: InvoiceScope) {
  const available = availableInvoiceForms(scope);
  if (available.length < 2) return null;
  return {
    key: "form",
    label: "서식",
    current: invoiceFormParam(form),
    options: available.map((f) => ({ value: FORM_PARAM[f], label: FORM_LABEL[f] })),
  };
}
