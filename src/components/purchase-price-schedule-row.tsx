"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { cancelPurchasePriceSchedule, updatePurchasePriceSchedule } from "@/app/(dashboard)/suppliers/actions";
import { FormMessage } from "@/components/form-message";
import { useConfirmTwice } from "@/lib/use-confirm-twice";

// 매입단가 예약 한 줄 — price-schedule-row.tsx(거래처용)와 동일한 UI를
// 공급처/매입단가 기준으로 미러링한다.
export function PurchasePriceScheduleRow({
  id,
  supplierId,
  productId,
  productLabel,
  currentUnitCost,
  newUnitCost,
  effectiveDate,
}: {
  id: string;
  supplierId: string;
  productId: string;
  productLabel: string;
  currentUnitCost: number | null;
  newUnitCost: number;
  effectiveDate: string;
}) {
  const [editing, setEditing] = useState(false);
  const [updateState, updateAction, updatePending] = useActionState(updatePurchasePriceSchedule, undefined);
  const [cancelPending, startCancelTransition] = useTransition();
  const confirmCancel = useConfirmTwice();

  useEffect(() => {
    if (updateState?.success) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 저장 성공 시 편집 모드를 닫는 동기화
      setEditing(false);
    }
  }, [updateState]);

  function handleCancel() {
    confirmCancel.press("cancel", () => {
      const formData = new FormData();
      formData.set("id", id);
      formData.set("supplier_id", supplierId);
      startCancelTransition(() => {
        cancelPurchasePriceSchedule(undefined, formData);
      });
    });
  }

  if (editing) {
    return (
      <div className="rounded p-2 text-xs" style={{ background: "var(--erp-info-bg)", border: "1px solid var(--erp-info-border)" }}>
        <p className="mb-1.5 font-medium">{productLabel}</p>
        <form action={updateAction} className="flex flex-wrap items-center gap-1.5">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="supplier_id" value={supplierId} />
          <input
            name="new_unit_cost"
            type="number"
            step="0.01"
            defaultValue={newUnitCost}
            required
            className="erp-input"
            style={{ height: 24, width: 100, fontSize: 11.5 }}
          />
          <input
            name="effective_date"
            type="date"
            defaultValue={effectiveDate}
            required
            className="erp-input"
            style={{ height: 24, fontSize: 11.5 }}
          />
          <button
            type="submit"
            disabled={updatePending}
            className="erp-btn erp-btn-primary"
            style={{ minWidth: 0, height: 24, padding: "0 8px", fontSize: 11.5 }}
          >
            {updatePending ? "저장 중..." : "저장"}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="erp-btn"
            style={{ minWidth: 0, height: 24, padding: "0 8px", fontSize: 11.5 }}
          >
            닫기
          </button>
        </form>
        <FormMessage state={updateState} />
      </div>
    );
  }

  const diff = currentUnitCost != null ? newUnitCost - currentUnitCost : null;
  const diffLabel =
    diff == null
      ? "신규 등록"
      : diff === 0
        ? "변동 없음"
        : `${Math.abs(diff).toLocaleString()}원 ${diff > 0 ? "인상" : "인하"}`;

  return (
    <div
      className="flex items-center justify-between gap-2 rounded p-2 text-xs"
      style={{ background: "var(--erp-info-bg)", border: "1px solid var(--erp-info-border)" }}
      data-product-id={productId}
    >
      <span>
        {effectiveDate}부터 {productLabel}:{" "}
        {currentUnitCost != null && <>{currentUnitCost.toLocaleString()}원 → </>}
        <strong>{newUnitCost.toLocaleString()}원</strong>{" "}
        <span style={{ color: "var(--erp-text-muted)" }}>({diffLabel})</span>
      </span>
      <div className="flex shrink-0 gap-1">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="erp-btn"
          style={{ minWidth: 0, height: 24, padding: "0 8px", fontSize: 11.5 }}
        >
          수정
        </button>
        <button
          type="button"
          disabled={cancelPending}
          onClick={handleCancel}
          onBlur={confirmCancel.reset}
          className="erp-btn erp-btn-danger"
          style={{ minWidth: 0, height: 24, padding: "0 8px", fontSize: 11.5 }}
        >
          {confirmCancel.isArmed("cancel") ? "한 번 더 누르면 취소" : "취소"}
        </button>
      </div>
    </div>
  );
}
