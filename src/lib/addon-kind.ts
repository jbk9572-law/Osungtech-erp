// add_on_products.kind(migration 194 체크 제약과 반드시 일치)를 사람이
// 읽는 라벨/단위로 보여주기 위한 공용 맵 — 등록 폼과 카드 목록 둘 다
// 이 맵 하나만 쓴다(복붙 금지, 개발헌법 3번).
export const ADDON_KIND_OPTIONS = [
  { value: "fax", label: "팩스", unit: "건" },
  { value: "invoice", label: "계산서", unit: "건" },
  { value: "alimtalk", label: "알림톡/문자", unit: "건" },
  { value: "vendor", label: "외주처 연동", unit: "개사" },
  { value: "storage", label: "저장소", unit: "GB" },
] as const;

export type AddOnKindValue = (typeof ADDON_KIND_OPTIONS)[number]["value"];

export function addonKindLabel(kind: string): string {
  return ADDON_KIND_OPTIONS.find((k) => k.value === kind)?.label ?? kind;
}

export function addonKindUnit(kind: string): string {
  return ADDON_KIND_OPTIONS.find((k) => k.value === kind)?.unit ?? "";
}
