"use client";

import { useRef, useState } from "react";
import { CellPopover } from "@/components/erp/cell-popover";

// 품목 줄 끝의 [⚙] — "품목없이 직접입력 / 규격 직접입력 / 단가 직접입력" 같은 줄 단위 켜고 끄기를 한 창에 모은다.
// 예전엔 이 체크가 칸 안/위에 떠서 입력칸을 가렸다. 선택된 옵션이 하나라도 있으면 버튼이 강조돼 어느 줄이 직접입력 상태인지 보인다.
export type RowOption = { key: string; label: string; checked: boolean; onChange: (checked: boolean) => void };

export function RowOptionsButton({ options }: { options: RowOption[] }) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  if (options.length === 0) return null;
  const anyOn = options.some((o) => o.checked);
  const close = () => {
    setRect(null);
    btnRef.current?.focus();
  };
  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={`erp-btn erp-btn-sm erp-u-minw-0 erp-u-mr-4 erp-row-action${anyOn ? " erp-row-action-on" : ""}`}
        title={anyOn ? `행 옵션: ${options.filter((o) => o.checked).map((o) => o.label).join(", ")}` : "행 옵션"}
        aria-label="행 옵션"
        aria-haspopup="dialog"
        onClick={() => setRect(btnRef.current?.getBoundingClientRect() ?? null)}
      >
        ⚙
      </button>
      {rect && (
        <CellPopover rect={rect} onClose={close} label="행 옵션" width={200}>
          {options.map((o) => (
            <label key={o.key} className="erp-rowopt">
              <input type="checkbox" checked={o.checked} onChange={(e) => o.onChange(e.target.checked)} />
              {o.label}
            </label>
          ))}
        </CellPopover>
      )}
    </>
  );
}
