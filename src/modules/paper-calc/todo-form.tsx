"use client";

import { useEffect, useState } from "react";
import { PageGuide } from "@/components/erp/page-guide";
import { formatNumber } from "@/lib/format-number";
import { PaperCalcModalTrigger } from "@/modules/paper-calc/components/paper-calc-modal-trigger";
import type { PendingCalcPayload } from "@/modules/paper-calc/components/paper-calc-client";
import { PENDING_PAPER_CALC_TODO_KEY } from "@/modules/paper-calc/lib/paper-calc-pending-key";

// 할일 등록 폼이 모조지 계산을 끼워 쓰는 자리(order-form.tsx의 할일 버전). 신규 등록일
// 때만 의미가 있고(수정 화면은 이미 todo id가 있어 계산 화면에서 바로 저장), 값은
// (1) 폼 안 모달의 "이 계산 적용하기" 콜백, (2) 독립 계산 화면에서 localStorage에
// 담아둔 것을 마운트 시 읽어오는 두 경로로 채워진다.
export function useTodoPaperCalc({ isEdit }: { isEdit: boolean }) {
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    if (isEdit) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from localStorage on mount
    setPending(localStorage.getItem(PENDING_PAPER_CALC_TODO_KEY));

    function handleStorage(e: StorageEvent) {
      if (e.key === PENDING_PAPER_CALC_TODO_KEY) setPending(e.newValue);
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [isEdit]);

  const totalSheet = (() => {
    if (!pending) return null;
    try {
      const parsed = JSON.parse(pending) as { totalSheet: number };
      return parsed.totalSheet > 0 ? parsed.totalSheet : null;
    } catch {
      return null;
    }
  })();

  return {
    isEdit,
    pending,
    totalSheet,
    apply: (payload: PendingCalcPayload) => setPending(JSON.stringify(payload)),
    // 제출 시점에 임시 계산을 같이 넘기고 나면 더 이상 필요 없으니 지운다. 등록이
    // 실패해도 계산 자체는 다시 하면 되므로 감수할 만한 트레이드오프다.
    clearStorageOnSubmit: () => {
      if (pending) localStorage.removeItem(PENDING_PAPER_CALC_TODO_KEY);
    },
    cancel: () => {
      localStorage.removeItem(PENDING_PAPER_CALC_TODO_KEY);
      setPending(null);
    },
  };
}

export type TodoPaperCalc = ReturnType<typeof useTodoPaperCalc>;

export function TodoPaperCalcHiddenInput({ pc }: { pc: TodoPaperCalc }) {
  return pc.pending ? <input type="hidden" name="pendingPaperCalc" value={pc.pending} /> : null;
}

export function TodoPaperCalcToolbarButton({ pc, enabled }: { pc: TodoPaperCalc; enabled: boolean }) {
  if (pc.isEdit || !enabled) return null;
  return <PaperCalcModalTrigger pendingFor="todo" onApply={pc.apply} />;
}

export function TodoPaperCalcBanner({ pc }: { pc: TodoPaperCalc }) {
  if (!pc.totalSheet) return null;
  return (
    <PageGuide className="mb-2 flex items-center justify-between gap-2">
      <span>모조지 계산 연결됨 — {formatNumber(pc.totalSheet)}연</span>
      <button
        type="button"
        className="erp-btn erp-btn-danger erp-btn-xs"
        style={{ minWidth: 0 }}
        onClick={pc.cancel}
      >
        취소
      </button>
    </PageGuide>
  );
}
