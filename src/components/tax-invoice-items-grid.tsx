"use client";

import { NumberInput } from "@/components/number-input";
import { formatNumber } from "@/lib/format-number";
import { MAX_TAX_INVOICE_ROWS, type TaxInvoiceRow } from "@/lib/tax-invoice-rows";

// table-layout: auto(기본값)로는 모바일 폭에서 입력칸이 찌그러진다 —
// new-quote-form.tsx와 같은 기법으로 표를 모든 칸 폭의 합만큼 고정폭으로 못박는다.
const ITEM_GRID_TOTAL_WIDTH = 110 + 200 + 110 + 70 + 90 + 110 + 90 + 140 + 50;

// 세금계산서/수정세금계산서 폼이 글자 그대로 똑같이 들고 있던 품목 표 + "품목 추가" 버튼.
// 수정세금계산서는 수량·금액이 음수일 수 있어(allowNegative) 그 차이만 속성으로 받는다.
export function TaxInvoiceItemsGrid({
  rows,
  onUpdate,
  onRemove,
  onAdd,
  totalSupply,
  totalTax,
  allowNegative = false,
}: {
  rows: TaxInvoiceRow[];
  onUpdate: (key: number, patch: Partial<TaxInvoiceRow>) => void;
  onRemove: (key: number) => void;
  onAdd: () => void;
  totalSupply: number;
  totalTax: number;
  allowNegative?: boolean;
}) {
  return (
    <>
      <div className="erp-grid-wrap">
        <table className="erp-grid" style={{ tableLayout: "fixed", width: "100%", minWidth: ITEM_GRID_TOTAL_WIDTH }}>
          <thead>
            <tr>
              <th style={{ width: 110 }}>날짜</th>
              <th style={{ width: 200 }}>품목</th>
              <th style={{ width: 110 }}>규격</th>
              <th className="num" style={{ width: 70 }}>수량</th>
              <th className="num" style={{ width: 90 }}>단가</th>
              <th className="num" style={{ width: 110 }}>공급가액</th>
              <th className="num" style={{ width: 90 }}>세액</th>
              <th style={{ width: 140 }}>비고</th>
              <th style={{ width: 50 }} />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td>
                  <input
                    type="date"
                    value={row.lineDate}
                    onChange={(e) => onUpdate(row.key, { lineDate: e.target.value })}
                    className="erp-input erp-u-w-full"
                  />
                </td>
                <td>
                  <input
                    value={row.itemName}
                    onChange={(e) => onUpdate(row.key, { itemName: e.target.value })}
                    className="erp-input erp-u-w-full"
                    autoComplete="off"
                  />
                </td>
                <td>
                  <input
                    value={row.spec}
                    onChange={(e) => onUpdate(row.key, { spec: e.target.value })}
                    className="erp-input erp-u-w-full"
                    autoComplete="off"
                  />
                </td>
                <td>
                  <NumberInput
                    value={row.quantity}
                    onChange={(n) => onUpdate(row.key, { quantity: n })}
                    className="erp-input"
                    allowNegative={allowNegative}
                    allowFormula
                  />
                </td>
                <td>
                  <NumberInput
                    value={row.unitPrice}
                    onChange={(n) => onUpdate(row.key, { unitPrice: n })}
                    className="erp-input"
                    allowNegative={allowNegative}
                  />
                </td>
                <td>
                  <NumberInput
                    value={row.supplyAmount}
                    onChange={(n) => onUpdate(row.key, { supplyAmount: n })}
                    className="erp-input"
                    allowNegative={allowNegative}
                  />
                </td>
                <td>
                  <NumberInput
                    value={row.taxAmount}
                    onChange={(n) => onUpdate(row.key, { taxAmount: n })}
                    className="erp-input"
                    allowNegative={allowNegative}
                  />
                </td>
                <td>
                  <input
                    value={row.remark}
                    onChange={(e) => onUpdate(row.key, { remark: e.target.value })}
                    className="erp-input erp-u-w-full"
                    autoComplete="off"
                  />
                </td>
                <td>
                  <button type="button" className="erp-btn erp-u-minw-0" onClick={() => onRemove(row.key)}>
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={5} className="num erp-u-bold">
                합계
              </td>
              <td className="num erp-doc-total">{formatNumber(totalSupply)}</td>
              <td className="num erp-doc-total">{formatNumber(totalTax)}</td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>

      <button
        type="button"
        className="erp-btn"
        onClick={onAdd}
        disabled={rows.length >= MAX_TAX_INVOICE_ROWS}
        style={{ alignSelf: "flex-start" }}
      >
        + 품목 추가 ({rows.length}/{MAX_TAX_INVOICE_ROWS})
      </button>
    </>
  );
}
