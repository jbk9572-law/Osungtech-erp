"use client";

import { useEffect, useRef, useState } from "react";

export type GalleryReceipt = { id: string; file_url: string };

// 영수증을 옆으로 넘기면서(스와이프/화살표/키보드) 볼 수 있는 전체화면
// 뷰어. 삭제·추가는 여기서 하지 않는다 — 실수로 지우는 걸 막으려고
// 수정 화면에서만 하도록 분리했다(보기 전용).
export function ReceiptGallery({ receipts }: { receipts: GalleryReceipt[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const touchStartX = useRef(0);

  useEffect(() => {
    if (openIndex === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenIndex(null);
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openIndex]);

  if (!receipts.length) {
    return <p className="erp-home-empty">첨부된 영수증이 없습니다.</p>;
  }

  function go(delta: number) {
    setOpenIndex((i) => (i === null ? i : (i + delta + receipts.length) % receipts.length));
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) < 40) return;
    go(dx < 0 ? 1 : -1);
  }

  const current = openIndex !== null ? receipts[openIndex] : null;

  return (
    <>
      <ul className="flex flex-wrap gap-3">
        {receipts.map((receipt, index) => (
          <li key={receipt.id}>
            <button
              type="button"
              onClick={() => setOpenIndex(index)}
              className="block overflow-hidden rounded-sm border p-0"
              style={{ borderColor: "var(--erp-border)", width: 88, height: 88 }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={receipt.file_url}
                alt={`영수증 ${index + 1}`}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </button>
          </li>
        ))}
      </ul>

      {current && (
        <div
          className="fixed inset-0 flex flex-col items-center justify-center bg-black/85"
          style={{ zIndex: 999 }}
          onClick={() => setOpenIndex(null)}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpenIndex(null);
            }}
            aria-label="닫기"
            className="absolute right-4 top-4 text-2xl text-white"
          >
            ×
          </button>

          <div
            className="relative flex w-full max-w-2xl items-center justify-center px-4"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {receipts.length > 1 && (
              <button
                type="button"
                onClick={() => go(-1)}
                aria-label="이전 영수증"
                className="absolute left-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-2xl text-white"
                style={{ background: "rgba(255,255,255,0.15)" }}
              >
                ‹
              </button>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={current.file_url}
              alt={`영수증 ${openIndex! + 1}`}
              className="max-h-[80vh] max-w-full select-none object-contain"
            />
            {receipts.length > 1 && (
              <button
                type="button"
                onClick={() => go(1)}
                aria-label="다음 영수증"
                className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-2xl text-white"
                style={{ background: "rgba(255,255,255,0.15)" }}
              >
                ›
              </button>
            )}
          </div>

          {receipts.length > 1 && (
            <p className="mt-3 text-sm text-white/80">
              {openIndex! + 1} / {receipts.length}
            </p>
          )}
        </div>
      )}
    </>
  );
}
