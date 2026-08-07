"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { cancelPriceSchedule, updatePriceSchedule } from "@/app/(dashboard)/customers/actions";
import { FormMessage } from "@/components/form-message";

// 단가 예약 한 줄 — 평소엔 "기존가 → 변경가 (차액)"만 보여주다가, 수정
// 버튼을 누르면 그 자리에서 바로 변경 단가/적용일을 고칠 수 있는 폼으로
// 바뀐다(취소 후 재등록할 필요 없이).
export function PriceScheduleRow({
  id,
  customerId,
  productId,
  productLabel,
  currentUnitPrice,
  newUnitPrice,
  effectiveDate,
}: {
  id: string;
  customerId: string;
  productId: string;
  productLabel: string;
  currentUnitPrice: number | null;
  newUnitPrice: number;
  effectiveDate: string;
}) {
  const [editing, setEditing] = useState(false);
  const [updateState, updateAction, updatePending] = useActionState(updatePriceSchedule, undefined);
  const [cancelPending, startCancelTransition] = useTransition();

  useEffect(() => {
    if (updateState?.success) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 저장 성공 시 편집 모드를 닫는 동기화
      setEditing(false);
    }
  }, [updateState]);

  function handleCancel() {
    if (!confirm("이 단가 예약을 취소하시겠습니까?")) return;
    const formData = new FormData();
    formData.set("id", id);
    formData.set("customer_id", customerId);
    startCancelTransition(() => {
      cancelPriceSchedule(undefined, formData);
    });
  }

  if (editing) {
    return (
      <div className="rounded p-2 text-xs" style={{ background: "var(--erp-info-bg)", border: "1px solid var(--erp-info-border)" }}>
        <p className="mb-1.5 font-medium">{productLabel}</p>
        <form action={updateAction} className="flex flex-wrap items-center gap-1.5">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="customer_id" value={customerId} />
          <input
            name="new_unit_price"
            type="number"
            step="0.01"
            defaultValue={newUnitPrice}
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

  const diff = currentUnitPrice != null ? newUnitPrice - currentUnitPrice : null;
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
        {currentUnitPrice != null && <>{currentUnitPrice.toLocaleString()}원 → </>}
        <strong>{newUnitPrice.toLocaleString()}원</strong>{" "}
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
          className="erp-btn erp-btn-danger"
          style={{ minWidth: 0, height: 24, padding: "0 8px", fontSize: 11.5 }}
        >
          취소
        </button>
      </div>
    </div>
  );
}
