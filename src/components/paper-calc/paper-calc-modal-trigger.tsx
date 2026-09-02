"use client";

import { useState } from "react";
import { PaperCalcClient, type PendingCalcPayload } from "@/components/paper-calc/paper-calc-client";
import { useEscapeToClose } from "@/lib/use-escape-to-close";

// 신규 판매/매입 등록 폼에서 모조지 계산을 새 탭 대신 모달로 띄운다. 아직
// 저장된 주문번호가 없는 화면이라, 계산이 끝나면 onApply로 결과를 바로
// 폼 상태에 꽂아넣고 모달을 닫는다 — localStorage에 담아 다른 탭이
// storage 이벤트로 감지하던 예전 방식보다 반응이 즉각적이고 코드도 단순하다.
export function PaperCalcModalTrigger({
  pendingFor,
  onApply,
}: {
  pendingFor: "sales" | "purchase" | "todo";
  onApply: (payload: PendingCalcPayload) => void;
}) {
  const [open, setOpen] = useState(false);
  useEscapeToClose(open, () => setOpen(false));

  return (
    <>
      <button type="button" className="erp-btn" onClick={() => setOpen(true)}>
        모조지 계산
      </button>
      {open && (
        <div className="erp-modal-overlay" onClick={() => setOpen(false)}>
          <div className="erp-modal erp-modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="erp-modal-title">
              모조지 계산
              <button type="button" className="erp-modal-close" onClick={() => setOpen(false)} aria-label="닫기">
                ✕
              </button>
            </div>
            <div className="erp-modal-body">
              <PaperCalcClient
                pendingFor={pendingFor}
                onApply={(payload) => {
                  onApply(payload);
                  setOpen(false);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
