"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
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

type SavedAdjustment = CountRow & { countedQuantity: number };

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
  // 서버에 저장한 뒤에도 페이지 자체는 다시 안 불러오므로(revalidatePath는
  // /inventory만 갱신), rows의 systemQuantity는 그대로 예전 값에 머문다.
  // 이걸 그냥 두면 저장 직후에도 "차이"가 그대로 남아있는 것처럼 보이고,
  // 실수로 같은 조정을 또 저장 버튼을 눌러 중복 반영할 위험도 있었다.
  // 저장에 성공한 품목만 baseline을 방금 실사한 값으로 맞춰준다.
  const [baseline, setBaseline] = useState<Record<string, number>>(() =>
    Object.fromEntries(rows.map((r) => [r.productId, r.systemQuantity]))
  );
  const [onlyDiff, setOnlyDiff] = useState(false);
  const [savedSummary, setSavedSummary] = useState<SavedAdjustment[] | null>(null);
  const submitRef = useRef<HTMLButtonElement>(null);
  useKeyShortcut("F7", submitRef);

  const changedRows = useMemo(
    () =>
      rows
        .map((r) => ({
          ...r,
          systemQuantity: baseline[r.productId] ?? r.systemQuantity,
          countedQuantity: counted[r.productId] ?? r.systemQuantity,
        }))
        .filter((r) => r.countedQuantity !== r.systemQuantity),
    [rows, counted, baseline]
  );

  // 저장 성공 시: 방금 저장한 조정 내역을 요약 패널에 보여주고, baseline을
  // 갱신해서 같은 화면에서 또 저장 버튼을 눌러도 이미 반영된 품목이
  // 중복으로 다시 저장되지 않게 한다.
  useEffect(() => {
    if (state?.success) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to a server action result, not derived state
      setSavedSummary(changedRows);
      setBaseline((prev) => {
        const next = { ...prev };
        for (const r of changedRows) next[r.productId] = r.countedQuantity;
        return next;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to state changing, changedRows is read at that moment
  }, [state]);

  const visibleRows = onlyDiff
    ? rows.filter(
        (r) => (counted[r.productId] ?? r.systemQuantity) !== (baseline[r.productId] ?? r.systemQuantity)
      )
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
      <div className="erp-search" style={{ alignItems: "center", justifyContent: "space-between" }}>
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
      {savedSummary && savedSummary.length > 0 && (
        <div
          className="rounded p-2 text-xs"
          style={{
            marginTop: 8,
            background: "var(--erp-success-bg)",
            border: "1px solid var(--erp-success-border)",
          }}
        >
          <div className="mb-2 flex items-center justify-between">
            <strong style={{ color: "var(--erp-success)" }}>
              이번 실사에서 {savedSummary.length}개 품목이 조정되었습니다.
            </strong>
            <button
              type="button"
              onClick={() => setSavedSummary(null)}
              className="text-[11px] font-semibold"
              style={{ color: "var(--erp-text-muted)" }}
            >
              닫기
            </button>
          </div>
          <div className="erp-grid-wrap">
            <table className="erp-grid">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>품목명</th>
                  <th className="num" style={{ width: 110 }}>
                    이전 수량
                  </th>
                  <th className="num" style={{ width: 110 }}>
                    조정 후
                  </th>
                  <th className="num" style={{ width: 90 }}>
                    차이
                  </th>
                </tr>
              </thead>
              <tbody>
                {savedSummary.map((r) => {
                  const diff = r.countedQuantity - r.systemQuantity;
                  return (
                    <tr key={r.productId}>
                      <td>{r.sku}</td>
                      <td>{r.name}</td>
                      <td className="num">{r.systemQuantity.toLocaleString()}</td>
                      <td className="num">{r.countedQuantity.toLocaleString()}</td>
                      <td
                        className="num"
                        style={{
                          fontWeight: 700,
                          color: diff > 0 ? "var(--erp-success)" : "var(--erp-danger)",
                        }}
                      >
                        {diff > 0 ? "+" : ""}
                        {diff.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
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
              const systemQuantity = baseline[row.productId] ?? row.systemQuantity;
              const value = counted[row.productId] ?? systemQuantity;
              const diff = value - systemQuantity;
              return (
                <tr key={row.productId}>
                  <td>{row.sku}</td>
                  <td>{row.name}</td>
                  <td style={{ color: "var(--erp-text-muted)" }}>{row.spec || "-"}</td>
                  <td className="num">
                    {systemQuantity.toLocaleString()} {row.unit ?? ""}
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
