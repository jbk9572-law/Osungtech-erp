// 세금계산서 발행 폼(tax-invoice-form)과 수정세금계산서 폼(tax-invoice-correction-form)이
// 글자 그대로 똑같이 들고 있던 품목 줄 계산을 한 곳으로 모았다. 화면(표)은
// components/tax-invoice-items-grid.tsx가 담당한다.
import { calcVat } from "@/lib/tax";

export type TaxInvoiceRow = {
  key: number;
  lineDate: string;
  itemName: string;
  spec: string;
  quantity: number;
  unitPrice: number;
  supplyAmount: number;
  taxAmount: number;
  remark: string;
};

// 홈택스 화면의 품목 줄은 최대 16개까지 추가 가능 — 같은 상한을 둔다.
export const MAX_TAX_INVOICE_ROWS = 16;

export function blankTaxInvoiceRow(key: number, defaultDate: string): TaxInvoiceRow {
  return { key, lineDate: defaultDate, itemName: "", spec: "", quantity: 0, unitPrice: 0, supplyAmount: 0, taxAmount: 0, remark: "" };
}

// 원본 품목으로 시작 줄을 깐다. 품목이 없으면 빈 줄 하나. 수정세금계산서는 수량을 음수로
// 뒤집어(negateQuantity) 깐다 — 이중발급 취소/전체 취소 후 재발행이 가장 흔한 경우라서.
export function seedTaxInvoiceRows(
  items: { itemName: string; spec: string; quantity: number; unitPrice: number }[],
  today: string,
  options: { negateQuantity?: boolean } = {},
): TaxInvoiceRow[] {
  if (items.length === 0) return [blankTaxInvoiceRow(0, today)];
  return items.slice(0, MAX_TAX_INVOICE_ROWS).map((r, i) => {
    const quantity = options.negateQuantity ? -r.quantity : r.quantity;
    const supplyAmount = quantity * r.unitPrice;
    return {
      key: i,
      lineDate: today,
      itemName: r.itemName,
      spec: r.spec,
      quantity,
      unitPrice: r.unitPrice,
      supplyAmount,
      taxAmount: calcVat(supplyAmount),
      remark: "",
    };
  });
}

// 한 줄의 값을 고친다. 수량이나 단가가 바뀌면 공급가액·세액을 다시 계산하고, 공급가액/세액을
// 직접 고친 경우에는 그 값을 그대로 둔다.
export function applyTaxInvoiceRowPatch(row: TaxInvoiceRow, patch: Partial<TaxInvoiceRow>): TaxInvoiceRow {
  const next = { ...row, ...patch };
  if (patch.quantity !== undefined || patch.unitPrice !== undefined) {
    next.supplyAmount = next.quantity * next.unitPrice;
    next.taxAmount = calcVat(next.supplyAmount);
  }
  return next;
}

// 품목명이 비어 있는 줄은 제외하고 합계와 서버로 보낼 items JSON을 만든다.
export function summarizeTaxInvoiceRows(rows: TaxInvoiceRow[]) {
  const validRows = rows.filter((r) => r.itemName.trim());
  const totalSupply = validRows.reduce((sum, r) => sum + r.supplyAmount, 0);
  const totalTax = validRows.reduce((sum, r) => sum + r.taxAmount, 0);
  const itemsJson = JSON.stringify(
    validRows.map((r) => ({
      lineDate: r.lineDate || null,
      itemName: r.itemName,
      spec: r.spec || null,
      quantity: r.quantity,
      unitPrice: r.unitPrice,
      supplyAmount: r.supplyAmount,
      taxAmount: r.taxAmount,
      remark: r.remark || null,
    })),
  );
  return { validRows, totalSupply, totalTax, totalAmount: totalSupply + totalTax, itemsJson };
}
