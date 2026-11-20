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
  /** 대시보드 배경 로고(원형) — 새 서식(N)의 워터마크로 쓴다. 안 올린 회사는 워터마크 없음. */
  logo_mark_url?: string | null;
} | null;

// 서식: B형(엔택스 원본 복제, 공급받는자는 상호+貴下만) / A형(엔택스 A형 복제, 공급받는자 사업자 정보까지) / N(우리가 설계한 새 공용 서식, 모던 테마 기본).
export type InvoiceForm = "A" | "B" | "N";

// A형의 공급받는자 칸에 채우는 상대 사업자 정보(거래처 또는 공급처 한 곳).
export type InvoiceParty = {
  name: string;
  business_number: string | null;
  representative_name: string | null;
  address: string | null;
  business_type: string | null;
  business_item: string | null;
};

// 거래처/공급처 행에서 A형이 쓰는 값만 뽑는다 — 두 테이블 모두 같은 이름의 컬럼을 갖고 있어 한 함수로 처리한다.
export function toInvoiceParty(
  row:
    | {
        name: string;
        business_number?: string | null;
        representative_name?: string | null;
        address?: string | null;
        business_type?: string | null;
        business_item?: string | null;
      }
    | null
    | undefined,
): InvoiceParty | null {
  if (!row) return null;
  return {
    name: row.name,
    business_number: row.business_number ?? null,
    representative_name: row.representative_name ?? null,
    address: row.address ?? null,
    business_type: row.business_type ?? null,
    business_item: row.business_item ?? null,
  };
}

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
