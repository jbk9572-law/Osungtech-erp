"use client";

import { useEffect, useRef, useState } from "react";
import { useEscapeToClose } from "@/lib/use-escape-to-close";
import { PageGuide } from "@/components/erp/page-guide";

// 이 위치에 있던 품목이 전부 빠져서(등록된 품목 0개) 방금 빈 상태가 됐을
// 때만 팝업으로 알려준다 — 페이지를 처음 열었을 때 이미 비어있던 경우는
// "방금 나간" 게 아니라서 띄우지 않는다(prevCountRef로 이전 렌더의 개수와
// 비교). 새로 품목을 채워서 다시 0보다 커지면 자동으로 닫힌다.
export function EmptyLocationAlert({ code, stockCount }: { code: string; stockCount: number }) {
  const prevCountRef = useRef(stockCount);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (prevCountRef.current > 0 && stockCount === 0) {
      setShow(true);
    } else if (stockCount > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 다시 채워지면(stockCount > 0) 자동으로 닫는 동기화
      setShow(false);
    }
    prevCountRef.current = stockCount;
  }, [stockCount]);

  useEscapeToClose(show, () => setShow(false));

  if (!show) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 20, 30, 0.55)",
        zIndex: 2000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div className="erp-detail" style={{ marginTop: 0, maxWidth: 360, width: "100%" }}>
        <div className="erp-detail-body" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{code} 위치가 비었습니다</div>
          <PageGuide className="mb-3 text-left">
            보관 중이던 품목이 전부 빠졌어요. 이제 이 위치에 새로운 품목을 바로 채울 수 있습니다.
          </PageGuide>
          <button
            type="button"
            className="erp-btn erp-btn-primary"
            style={{ width: "100%" }}
            onClick={() => setShow(false)}
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
