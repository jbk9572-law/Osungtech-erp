"use client";

import { useActionState, useRef, useState } from "react";
import { createStockTransfer } from "@/app/(dashboard)/inventory/transfers/actions";
import { ProductSearchSelect } from "@/components/product-search-select";
import { NumberInput } from "@/components/number-input";
import { FormMessage } from "@/components/form-message";
import { useKeyedRows } from "@/lib/use-keyed-rows";
import { preventEnterSubmit } from "@/lib/prevent-enter-submit";
import { useKeyShortcut } from "@/lib/use-key-shortcut";

type Row = { key: number; productId: string; quantity: number; remark: string };

function blankRow(key: number): Row {
  return { key, productId: "", quantity: 0, remark: "" };
}

export function NewStockTransferForm({
  today,
  warehouses,
  products,
}: {
  today: string;
  warehouses: { id: string; name: string }[];
  products: { id: string; sku: string; name: string; spec: string | null }[];
}) {
  const [state, formAction, pending] = useActionState(createStockTransfer, undefined);
  const submitRef = useRef<HTMLButtonElement>(null);
  useKeyShortcut("F7", submitRef);
  const [fromWarehouseId, setFromWarehouseId] = useState(warehouses[0]?.id ?? "");
  const [toWarehouseId, setToWarehouseId] = useState(warehouses[1]?.id ?? warehouses[0]?.id ?? "");
  const { rows, addRow, removeRow, setRows } = useKeyedRows<Row>([blankRow(0)], blankRow);

  function updateRow(key: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  const validRows = rows.filter((r) => r.productId && r.quantity > 0);
  const itemsJson = JSON.stringify(
    validRows.map((r) => ({ productId: r.productId, quantity: r.quantity, remark: r.remark || null }))
  );
  const sameWarehouse = fromWarehouseId !== "" && fromWarehouseId === toWarehouseId;

  return (
    <form action={formAction} onKeyDown={preventEnterSubmit} className="flex flex-col gap-3">
      <input type="hidden" name="from_warehouse_id" value={fromWarehouseId} />
      <input type="hidden" name="to_warehouse_id" value={toWarehouseId} />
      <input type="hidden" name="items" value={itemsJson} />

      <div className="grid grid-cols-3 gap-3" style={{ maxWidth: 620 }}>
        <div className="erp-field">
          <label htmlFor="st-from">출발 창고</label>
          <select id="st-from" className="erp-input" value={fromWarehouseId} onChange={(e) => setFromWarehouseId(e.target.value)}>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
        <div className="erp-field">
          <label htmlFor="st-to">도착 창고</label>
          <select id="st-to" className="erp-input" value={toWarehouseId} onChange={(e) => setToWarehouseId(e.target.value)}>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
        <div className="erp-field">
          <label htmlFor="st-date">이동일</label>
          <input id="st-date" name="transfer_date" type="date" defaultValue={today} className="erp-input" />
        </div>
      </div>

      {sameWarehouse && (
        <p className="text-xs" style={{ color: "var(--erp-danger)" }}>
          출발 창고와 도착 창고가 같을 수 없습니다.
        </p>
      )}

      <div className="erp-field" style={{ maxWidth: 720 }}>
        <label htmlFor="st-memo">메모(선택)</label>
        <textarea id="st-memo" name="memo" rows={2} className="erp-input" style={{ resize: "vertical" }} />
      </div>

      <div className="erp-grid-wrap">
        <table className="erp-grid">
          <thead>
            <tr>
              <th style={{ width: 280 }}>품목</th>
              <th className="num" style={{ width: 110 }}>수량</th>
              <th>비고</th>
              <th style={{ width: 50 }} />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td>
                  <ProductSearchSelect
                    products={products}
                    value={row.productId}
                    onChange={(productId) => updateRow(row.key, { productId })}
                  />
                </td>
                <td>
                  <NumberInput value={row.quantity} onChange={(n) => updateRow(row.key, { quantity: n })} className="erp-input" />
                </td>
                <td>
                  <input
                    value={row.remark}
                    onChange={(e) => updateRow(row.key, { remark: e.target.value })}
                    className="erp-input"
                    autoComplete="off"
                  />
                </td>
                <td>
                  <button type="button" className="erp-btn" onClick={() => removeRow(row.key)} style={{ minWidth: 0 }}>
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button type="button" className="erp-btn" onClick={addRow} style={{ alignSelf: "flex-start" }}>
        + 품목 추가
      </button>

      <div className="flex items-center gap-2">
        <button
          ref={submitRef}
          type="submit"
          className="erp-btn erp-btn-primary"
          disabled={pending || sameWarehouse || !fromWarehouseId || !toWarehouseId || validRows.length === 0}
        >
          {pending ? "등록 중..." : "F7 창고 이동 등록"}
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
