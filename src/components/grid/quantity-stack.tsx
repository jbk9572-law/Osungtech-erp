"use client";

import { useEffect, useRef, useState } from "react";

// 단위별 수량 글자("225 ROLL · 532 KG · 39,420 EA")를 표 안에서 보여주는 공용 부품 모음.
// 단위가 섞인 수량을 한 줄로 길게 이으면 합계 줄의 단위 수만큼 수량 칸이 넓어져 표가 가로로 밀린다 — 자리마다 알맞게 줄인다.
//  · QuantityStack  전표 한 줄의 수량: 단위 2개까지는 두 줄로 쌓고, 3개 이상은 "225 ROLL 외 2종"(전체는 마우스를 올리면 보인다)
//  · QuantityTotal  합계 줄의 수량: 단위가 하나면 그대로, 여럿이면 "단위 N종 ▾" — 누르면 단위별 합계 창
//  · QuantityChips  목록 위 요약줄: 단위별 총량 칩
// 복사(공유 이미지·엑셀)에는 줄여 보이는 칸도 전체 글자를 담는다 — 호출부가 <td data-copy-text=전체> 를 붙인다(grid-range-select 의 cellText).
const SEP = " · ";
const parts = (text: string) => text.split(SEP).filter(Boolean);

export function QuantityStack({ text }: { text: string }) {
  const p = parts(text);
  if (p.length <= 1) return <>{text}</>;
  if (p.length >= 3) {
    return (
      <span title={text}>
        {p[0]} 외 {p.length - 1}종
      </span>
    );
  }
  return (
    <span className="erp-qty-stack">
      {p.map((x, i) => (
        <span key={i}>{x}</span>
      ))}
    </span>
  );
}

export function QuantityTotal({ text }: { text: string }) {
  const p = parts(text);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  if (p.length <= 1) return <>{text}</>;
  return (
    <span className="erp-qty-total" ref={ref}>
      <button type="button" className="erp-qty-total-btn" aria-expanded={open} onClick={() => setOpen((v) => !v)} title={text}>
        단위 {p.length}종 ▾
      </button>
      {open && (
        <span className="erp-qty-pop" role="dialog" aria-label="단위별 합계">
          {p.map((x, i) => (
            <span key={i}>{x}</span>
          ))}
        </span>
      )}
    </span>
  );
}

export function QuantityChips({ text }: { text: string | undefined }) {
  const p = text ? parts(text) : [];
  if (p.length === 0) return null;
  return (
    <div className="erp-qty-chips" aria-label="단위별 수량 합계">
      <span className="erp-qty-chips-label">수량 합계</span>
      {p.map((x, i) => (
        <span key={i} className="erp-qty-chip">
          {x}
        </span>
      ))}
    </div>
  );
}
