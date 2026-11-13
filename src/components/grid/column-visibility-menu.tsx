"use client";

import { useRef, useState } from "react";
import { useEscapeToClose } from "@/lib/use-escape-to-close";

export type ColumnVisibilityOption = { key: string; label: string };

// 매출/매입 등 가로형 표 위에 두는 "컬럼 설정" 버튼 — 계정마다 보고
// 싶은 칸이 다를 수 있다는 요청으로, 체크박스로 켜고 끈 결과를
// useColumnVisibility가 계정별로 저장한다. 항상 보여야 하는 핵심 칸
// (날짜/거래처/금액 등)은 애초에 options에 안 넣어서 끌 수 없게 한다.
export function ColumnVisibilityMenu({
  options,
  isHidden,
  onToggle,
}: {
  options: ColumnVisibilityOption[];
  isHidden: (key: string) => boolean;
  onToggle: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  useEscapeToClose(open, () => setOpen(false));

  return (
    <div className="erp-u-relative erp-u-inline-block"
      ref={wrapRef}
      // 메뉴 바깥 클릭 시 닫히게 — 포커스가 메뉴 밖으로 나가는 순간 닫는다.
      onBlur={(e) => {
        if (!wrapRef.current?.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        type="button"
        className="erp-btn"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        title="보이는 칸 설정"
      >
        컬럼 설정
      </button>
      {open && (
        <div className="erp-u-absolute erp-u-bg-panel erp-u-border erp-u-radius-xl erp-u-overflow-y-auto"
          role="menu"
          style={{ top: "calc(100% + 4px)", right: 0, zIndex: 30, minWidth: 160, maxHeight: 320, boxShadow: "var(--erp-shadow-lg)", padding: "var(--erp-space-2)" }}
        >
          {options.map((opt) => (
            <label className="erp-u-flex erp-u-items-center erp-u-gap-6 erp-u-pad-4-6 erp-u-text-sm erp-u-pointer"
              key={opt.key}
            >
              <input type="checkbox" checked={!isHidden(opt.key)} onChange={() => onToggle(opt.key)} />
              {opt.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
