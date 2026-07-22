"use client";

import { useEffect, useState } from "react";
import { PaperCalcClient, type PendingCalcPayload } from "@/components/paper-calc/paper-calc-client";

// 신규 판매/매입 등록 폼에서 모조지 계산을 새 탭 대신 모달로 띄운다. 아직
// 저장된 주문번호가 없는 화면이라, 계산이 끝나면 onApply로 결과를 바로
// 폼 상태에 꽂아넣고 모달을 닫는다 — localStorage에 담아 다른 탭이
// storage 이벤트로 감지하던 예전 방식보다 반응이 즉각적이고 코드도 단순하다.
export function PaperCalcModalTrigger({
  pendingFor,
  onApply,
}: {
  pendingFor: "sales" | "purchase";
  onApply: (payload: PendingCalcPayload) => void;
}) {
  const [open, setOpen] = useState(false);

  // 이 모달이 열리는 등록 화면들은 페이지 자체에 ESC로 목록으로 나가는
  // 전역 단축키(KeyboardShortcuts, window에 버블 단계로 걸려있음)가 있다.
  // 모달 안에서 Escape로 그냥 닫으려던 것뿐인데 그 이벤트가 그대로 그
  // 단축키까지 도달하면, 입력 중이던 등록 폼 전체를 나가버리는 사고가
  // 난다. 캡처 단계에서 먼저 가로채 stopPropagation해야 확실히 막을 수
  // 있다 — 모달을 막 열어서 트리거 버튼에 포커스가 남아있는 순간처럼,
  // 포커스가 모달 안으로 들어오기 전에 누르는 경우까지 버블 단계 핸들러로는
  // 못 막기 때문이다.
  useEffect(() => {
    if (!open) return;
    function handleEscapeCapture(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    }
    window.addEventListener("keydown", handleEscapeCapture, true);
    return () => window.removeEventListener("keydown", handleEscapeCapture, true);
  }, [open]);

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
              <button type="button" className="erp-modal-close" onClick={() => setOpen(false)}>
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
