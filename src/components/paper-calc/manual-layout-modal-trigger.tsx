"use client";

import { useState } from "react";
import { ManualLayoutClient } from "@/components/paper-calc/manual-layout-client";
import { useEscapeToClose } from "@/lib/use-escape-to-close";

// PaperCalcModalTrigger(모조지 계산)와 똑같은 방식으로, 신규 판매/매입
// 등록 폼 안에서 재단 배치 시뮬레이터도 새 탭 대신 같은 창 안의 중첩
// 모달로 띄운다. 이 폼이 이미 모달(등록 모달)로 열려 있는 상태에서
// /paper-calc/manual로 라우트 이동을 해버리면 그 등록 모달 자체가
// 다른 화면으로 갈아치워져 입력하던 품목 줄이 사라지는데, 이 컴포넌트는
// 라우트를 전혀 바꾸지 않는 순수 React 상태 기반 팝업이라 그 문제가
// 없다.
//
// 다만 ManualLayoutClient의 "새 판매/매입 등록에 연결" 버튼은 원래
// 독립된 화면(다른 탭)에서 계산한 뒤 localStorage에 담아두고, 이미 열려
// 있는 등록 폼이 storage 이벤트(다른 탭에서 쓴 값 감지)로 집어가는
// 방식이었다 — 그런데 storage 이벤트는 "같은 창" 안에서 쓴 값에는 원래
// 발생하지 않는다(브라우저 스펙). 그래서 이 팝업을 닫는 시점에
// onClose로 부모(등록 폼)에게 알려, 그때 localStorage를 직접 다시
// 읽게 한다 — 폼이 처음 마운트될 때 하던 것과 똑같은 방식을 "팝업 닫힘"
// 시점에도 한 번 더 해주는 셈이다.
export function ManualLayoutModalTrigger({
  pendingFor,
  onClose,
}: {
  pendingFor: "sales" | "purchase";
  onClose?: () => void;
}) {
  const [open, setOpen] = useState(false);

  function close() {
    setOpen(false);
    onClose?.();
  }

  // ESC로 닫을 때도 "새 판매/매입 등록에 연결"을 눌러뒀을 수 있으니
  // backdrop 클릭/닫기 버튼과 똑같이 onClose를 같이 호출한다.
  useEscapeToClose(open, close);

  return (
    <>
      <button type="button" className="erp-btn" onClick={() => setOpen(true)} style={{ minWidth: 0 }}>
        재단 배치 시뮬레이터
      </button>
      {open && (
        <div className="erp-modal-overlay" onClick={close}>
          <div className="erp-modal erp-modal-xl" onClick={(e) => e.stopPropagation()}>
            <div className="erp-modal-title">
              재단 배치 시뮬레이터
              <button type="button" className="erp-modal-close" onClick={close} aria-label="닫기">
                ✕
              </button>
            </div>
            <div className="erp-modal-body">
              <ManualLayoutClient pendingFor={pendingFor} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
