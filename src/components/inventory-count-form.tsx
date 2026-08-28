"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { submitStockCount } from "@/app/(dashboard)/inventory/actions";
import { NumberInput } from "@/components/number-input";
import { FormMessage } from "@/components/form-message";
import { useKeyShortcut } from "@/lib/use-key-shortcut";

export type CountRow = {
  productId: string;
  sku: string;
  name: string;
  spec: string | null;
  unit: string | null;
  systemQuantity: number;
};

export function InventoryCountForm({
  rows,
  warehouseId,
}: {
  rows: CountRow[];
  warehouseId: string;
}) {
  const [state, formAction, pending] = useActionState(submitStockCount, undefined);
  // 기본값을 전산 재고와 똑같이 채워둬서, 직원은 실제로 다른 품목의
  // 칸만 고치면 된다 — 전체 품목 수만큼 매번 처음부터 입력할 필요가 없다.
  const [counted, setCounted] = useState<Record<string, number>>(() =>
    Object.fromEntries(rows.map((r) => [r.productId, r.systemQuantity]))
  );
  const [onlyDiff, setOnlyDiff] = useState(false);
  const submitRef = useRef<HTMLButtonElement>(null);
  useKeyShortcut("F7", submitRef);

  const changedRows = useMemo(
    () =>
      rows
        .map((r) => ({ ...r, countedQuantity: counted[r.productId] ?? r.systemQuantity }))
        .filter((r) => r.countedQuantity !== r.systemQuantity),
    [rows, counted]
  );

  const visibleRows = onlyDiff
    ? rows.filter((r) => (counted[r.productId] ?? r.systemQuantity) !== r.systemQuantity)
    : rows;

  const payload = JSON.stringify(
    changedRows.map((r) => ({
      productId: r.productId,
      systemQuantity: r.systemQuantity,
      countedQuantity: r.countedQuantity,
    }))
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="warehouse_id" value={warehouseId} />
      <input type="hidden" name="rows" value={payload} />
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <label
          className="flex items-center gap-2 text-xs"
          style={{ color: "var(--erp-text-muted)" }}
        >
          <input
            type="checkbox"
            checked={onlyDiff}
            onChange={(e) => setOnlyDiff(e.target.checked)}
          />
          차이 있는 품목만 보기
        </label>
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: "var(--erp-text-muted)" }}>
            차이 {changedRows.length}건
          </span>
          <button
            ref={submitRef}
            type="submit"
            disabled={pending || changedRows.length === 0}
            className="erp-btn erp-btn-primary"
          >
            {pending ? (
              <>
                <span className="erp-spinner" aria-hidden /> 저장 중...
              </>
            ) : (
              `F7 실사 결과 저장 (${changedRows.length}건)`
            )}
          </button>
        </div>
      </div>
      <FormMessage state={state} />
      <div className="erp-grid-wrap" style={{ marginTop: 8 }}>
        <table className="erp-grid">
          <thead>
            <tr>
              <th>SKU</th>
              <th>품목명</th>
              <th style={{ width: 140 }}>규격</th>
              <th className="num" style={{ width: 110 }}>
                전산 재고
              </th>
              <th className="num" style={{ width: 140 }}>
                실사 수량
              </th>
              <th className="num" style={{ width: 100 }}>
                차이
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => {
              const value = counted[row.productId] ?? row.systemQuantity;
              const diff = value - row.systemQuantity;
              return (
                <tr key={row.productId}>
                  <td>{row.sku}</td>
                  <td>{row.name}</td>
                  <td style={{ color: "var(--erp-text-muted)" }}>{row.spec || "-"}</td>
                  <td className="num">
                    {row.systemQuantity.toLocaleString()} {row.unit ?? ""}
                  </td>
                  <td className="num">
                    <NumberInput
                      value={value}
                      onChange={(n) =>
                        setCounted((prev) => ({ ...prev, [row.productId]: n }))
                      }
                      className="erp-input w-full"
                    />
                  </td>
                  <td
                    className="num"
                    style={{
                      fontWeight: diff !== 0 ? 700 : undefined,
                      color:
                        diff > 0
                          ? "var(--erp-success)"
                          : diff < 0
                            ? "var(--erp-danger)"
                            : "var(--erp-text-muted)",
                    }}
                  >
                    {diff > 0 ? "+" : ""}
                    {diff.toLocaleString()}
                  </td>
                </tr>
              );
            })}
            {!visibleRows.length && (
              <tr>
                <td colSpan={6} className="erp-grid-empty">
                  {onlyDiff ? "차이 있는 품목이 없습니다." : "표시할 품목이 없습니다."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </form>
  );
}
