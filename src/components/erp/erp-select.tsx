"use client";

import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useEscapeToClose } from "@/lib/use-escape-to-close";
import { useDropdownReposition } from "@/lib/use-dropdown-reposition";
import { useHighlightScroll } from "@/lib/use-highlight-scroll";

export type ErpSelectOption = { value: string; label: string };

// 네이티브 <select>는 선택창(옵션 목록) 자체가 OS/브라우저가 그리는
// 네이티브 팝업이라 border-radius를 전혀 줄 수 없다(어느 브라우저도
// 불가능 — 플랫폼 한계) — 닫힌 상태만 둥글고 펼치면 각지게 보이는
// 불일치가 생긴다(사용자 지적). PartySearchSelect/ProductSearchSelect와
// 같은 패턴(버튼 + document.body 포털 드롭다운)으로 직접 그려서 열고
// 닫힌 상태 둘 다 우리 토큰으로 완전히 스타일링한다.
export function ErpSelect({
  options,
  value,
  onChange,
  placeholder = "선택",
  name,
  id,
  form,
  required,
  disabled,
  ariaLabel,
  style,
}: {
  options: ErpSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  name?: string;
  id?: string;
  // 숨긴 <form>을 따로 두고 나머지 입력칸은 form="id"로 연결하는
  // 카드형 목록 패턴(addon-product-row.tsx 등)에서, 이 select가 그
  // 바깥 폼으로 값을 제출하려면 숨김 input에도 같은 form 연결이
  // 필요하다(네이티브 select의 form 속성과 동일한 역할).
  form?: string;
  required?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  style?: React.CSSProperties;
}) {
  const selected = options.find((o) => o.value === value) ?? null;
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number; width: number } | null>(
    null
  );
  const itemRefs = useHighlightScroll(highlight, open);
  useEscapeToClose(open, () => setOpen(false));

  const updateDropdownRect = useCallback(() => {
    const el = buttonRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setDropdownRect({ top: rect.bottom + 4, left: rect.left, width: rect.width });
  }, []);
  useDropdownReposition(open, updateDropdownRect);

  function openDropdown() {
    if (disabled || options.length === 0) return;
    updateDropdownRect();
    const current = options.findIndex((o) => o.value === value);
    setHighlight(current >= 0 ? current : 0);
    setOpen(true);
  }

  function choose(v: string) {
    onChange(v);
    setOpen(false);
    buttonRef.current?.focus();
  }

  return (
    <div className="relative">
      {name && <input type="hidden" name={name} value={value} required={required} form={form} />}
      <button
        ref={buttonRef}
        type="button"
        id={id}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openDropdown())}
        onBlur={() => {
          setTimeout(() => setOpen(false), 150);
        }}
        onKeyDown={(e) => {
          if (!open) {
            if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openDropdown();
            }
            return;
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((i) => Math.min(i + 1, options.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter" && options[highlight]) {
            e.preventDefault();
            choose(options[highlight].value);
          }
        }}
        className="erp-select erp-select-btn"
        style={style}
      >
        <span className={selected ? undefined : "erp-select-placeholder"}>
          {selected ? selected.label : placeholder}
        </span>
        <span className="erp-select-caret" aria-hidden="true">
          ▾
        </span>
      </button>
      {open &&
        dropdownRect &&
        typeof document !== "undefined" &&
        createPortal(
          <ul
            role="listbox"
            className="erp-select-popup erp-u-fixed"
            style={{ top: dropdownRect.top, left: dropdownRect.left, width: dropdownRect.width }}
          >
            {options.map((o, i) => (
              <li key={o.value}>
                <button
                  ref={(el) => {
                    itemRefs.current[i] = el;
                  }}
                  type="button"
                  role="option"
                  aria-selected={o.value === value}
                  onMouseEnter={() => setHighlight(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    choose(o.value);
                  }}
                  className="erp-select-option"
                  data-highlight={i === highlight ? "1" : undefined}
                  data-selected={o.value === value ? "1" : undefined}
                >
                  {o.label}
                </button>
              </li>
            ))}
          </ul>,
          document.body
        )}
    </div>
  );
}
