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
// 품목 테이블의 모든 행(입력된 행/빈 행 포함)이 항상 같은 높이를 갖도록 고정.
// 비어 있는 셀은 내용이 없어 줄 높이가 생기지 않아 그냥 두면 입력된 행보다
// 얇게 찌그러지는 문제가 있어, 모든 품목 행에 동일한 높이를 강제로 지정한다.
export const ITEM_ROW_HEIGHT = "h-[22px]";

export function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
