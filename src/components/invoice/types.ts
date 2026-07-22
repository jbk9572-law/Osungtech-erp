// 0707 원본 PDF(엔택스 B형 서식, 거래명세표)를 기준으로 재구성한 타입 정의.
// 이 파일의 모든 값은 실제 화면/데이터에서 props로 주입되며 하드코딩된
// 텍스트는 없다.
export type Company = {
  name: string;
  business_number: string | null;
  representative_name: string | null;
  phone: string | null;
  fax_number: string | null;
  business_type: string | null;
  business_item: string | null;
  address: string | null;
  email: string | null;
  greeting_message: string | null;
  seal_image_url?: string | null;
} | null;

export type InvoiceItem = {
  id: string;
  monthDay: string;
  productLabel: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  supplyAmount: number;
  taxAmount: number;
  remark?: string | null;
  // 모조지(TG0) 계산에 들어간 사이즈별 수량처럼, 실제로 별도 청구되는
  // 품목이 아니라 참고용으로만 보여주는 줄. 수량/단가/공급가/세액은
  // 합계에 넣지 않고 화면에도 "-"로 표시한다.
  isReference?: boolean;
};

export const COLOR_HEX = {
  blue: "#0000FF",
  red: "#FF0000",
} as const;

export type InvoiceColor = keyof typeof COLOR_HEX;
export type CopyLabel = "공급받는자 보관용" | "공급자 보관용";

// 원본 엑셀(34개 열)의 실제 열 너비 비율을 그대로 유지한 채 %로 변환한 값.
// 고정 px가 아니라 %로 두어야 인쇄 시 A4 용지 폭을 실제로 꽉 채운다.
export const COL_WIDTHS = [
  3.2821, 3.2821, 2.7821, 2.7821, 2.7821, 2.7821, 2.7821, 3.4003, 2.7821, 2.7821, 3.4003, 2.7821,
  2.7821, 2.7821, 2.7821, 2.473, 3.5549, 2.473, 2.473, 2.473, 2.473, 2.473, 2.473, 2.473, 2.473,
  6.1097, 5.1005, 2.473, 2.473, 1.7002, 2.473, 2.7821, 2.473, 4.6368,
];

export const ITEM_COLS = [2, 10, 3, 3, 4, 4, 4, 4] as const;

export function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
