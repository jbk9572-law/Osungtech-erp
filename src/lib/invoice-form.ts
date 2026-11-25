import { getThemeFeatures } from "@/lib/erp-theme-config";

export type InvoiceFormChoice = "A" | "B" | "N" | "NB";

/** 이 회사가 어떤 서식을 쓸 수 있는지 가르는 값 — 테마(tenants.theme)와 회사 식별자(tenants.slug). */
export type InvoiceScope = {
  theme: string | null | undefined;
  slug: string | null | undefined;
  /** 플랫폼 관리자가 이 회사에 지정한 서식 목록. 없으면(null/undefined) "미지정" — 아래 기존 규칙을 따른다. */
  allowedForms?: readonly string[] | null;
};

/** 모든 서식(선택지 순서). 플랫폼 관리자 화면의 체크 목록도 이 순서를 쓴다. */
export const ALL_INVOICE_FORMS: readonly InvoiceFormChoice[] = ["N", "NB", "B", "A"];

// 엔택스 복제형(A·B형)은 엔택스 서식을 쓰는 회사(지금은 오성테크)에만 보인다. 다른 회사에는 엔택스 서식이 선택지로도 나오지 않는다.
// 새 회사가 엔택스 서식을 쓰게 되면 이 목록에만 slug를 추가한다.
export const ENTAX_FORM_TENANT_SLUGS: readonly string[] = ["osungtech"];

export const INVOICE_FORM_LABEL: Record<InvoiceFormChoice, string> = { N: "엘보닉스 A형", NB: "엘보닉스 B형", B: "엔택스 B형", A: "엔택스 A형" };
const FORM_PARAM: Record<InvoiceFormChoice, "n" | "nb" | "a" | "b"> = { N: "n", NB: "nb", B: "b", A: "a" };

/**
 * 이 회사가 쓸 수 있는 서식 목록(선택지 순서).
 * - (기존 규칙, 플랫폼 관리자가 지정하지 않은 회사) 엘보닉스 A형·B형(둘 다 2연식·전지)은 모던 그리드 테마에서만 선택지로 나온다 — 클래식 화면에는 나오지 않는다.
 * - 엔택스 B형·A형은 오성테크(엔택스 서식을 쓰는 회사)에서만 나온다.
 * - 클래식 + 오성테크 아님: 고를 서식이 없어 인쇄가 막히지 않게 엘보닉스 A형 하나로 인쇄하고, 선택줄은 감춘다(아래 invoiceFormOptionGroup).
 */
/** 기존 규칙(플랫폼 관리자가 지정하지 않은 회사) — 테마와 회사 식별자로 가른다. 플랫폼 관리자 화면이 "지금 보이는 목록"을 처음 체크값으로 보여줄 때도 쓴다. */
export function legacyInvoiceForms(scope: InvoiceScope): InvoiceFormChoice[] {
  const isEntaxTenant = !!scope.slug && ENTAX_FORM_TENANT_SLUGS.includes(scope.slug);
  const isModern = getThemeFeatures(scope.theme).defaultInvoiceForm === "N";
  if (isModern) return isEntaxTenant ? ["N", "NB", "B", "A"] : ["N", "NB"];
  return isEntaxTenant ? ["B", "A"] : ["N"];
}

export function availableInvoiceForms(scope: InvoiceScope): InvoiceFormChoice[] {
  // 플랫폼 관리자가 지정한 목록이 있으면 그것만(알 수 없는 값은 버린다). 지정이 비었거나 전부 알 수 없는 값이면 기존 규칙 — 인쇄가 막히지 않게.
  const picked = ALL_INVOICE_FORMS.filter((f) => scope.allowedForms?.includes(f));
  return picked.length > 0 ? picked : legacyInvoiceForms(scope);
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
    options: available.map((f) => ({ value: FORM_PARAM[f], label: INVOICE_FORM_LABEL[f] })),
  };
}
