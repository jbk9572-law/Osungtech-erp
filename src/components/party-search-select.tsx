"use client";

import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Party = { id: string; name: string };

// 출고처/공급처를 드롭다운으로만 고르면, 거래처가 많아질수록 원하는 이름을
// 찾으려고 목록을 계속 스크롤해야 했다. ProductSearchSelect(품목 검색)와
// 동일한 패턴으로, 거래처명을 타이핑해서 바로 찾을 수 있게 한다.
export function PartySearchSelect({
  parties,
  value,
  onChange,
  placeholder = "거래처명 검색",
  name,
  id,
}: {
  parties: Party[];
  value: string;
  onChange: (partyId: string) => void;
  placeholder?: string;
  name?: string;
  id?: string;
}) {
  const selected = parties.find((p) => p.id === value) ?? null;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  // 매출/매입 등록 폼의 상세정보 영역은 넓지 않지만, 화면 하단부에 있는
  // 경우 드롭다운이 화면 밖으로 잘릴 수 있어 ProductSearchSelect와 동일하게
  // document.body에 포털로 렌더링하고 position:fixed로 좌표를 맞춘다.
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number; width: number } | null>(
    null
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return parties.slice(0, 20);
    return parties.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 20);
  }, [parties, query]);

  function selectParty(partyId: string) {
    onChange(partyId);
    setQuery("");
    setOpen(false);
    setHighlight(0);
  }

  return (
    <div className="relative">
      {name && <input type="hidden" name={name} value={value} />}
      <input
        ref={inputRef}
        id={id}
        type="text"
        value={open ? query : (selected ? selected.name : "")}
        placeholder={placeholder}
        aria-label={placeholder}
        onFocus={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setDropdownRect({ top: rect.bottom + 4, left: rect.left, width: rect.width });
          setQuery("");
          setOpen(true);
          setHighlight(0);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setHighlight(0);
        }}
        onBlur={() => {
          setTimeout(() => setOpen(false), 150);
        }}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((i) => Math.min(i + 1, results.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter" && results[highlight]) {
            e.preventDefault();
            selectParty(results[highlight].id);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        className="erp-input"
        style={{ width: "100%" }}
      />
      {open &&
        dropdownRect &&
        typeof document !== "undefined" &&
        createPortal(
          <ul
            className="max-h-56 overflow-y-auto rounded-sm border border-[var(--erp-border)] bg-white text-[12.5px] shadow-md"
            style={{
              position: "fixed",
              top: dropdownRect.top,
              left: dropdownRect.left,
              width: dropdownRect.width,
              zIndex: 1000,
            }}
          >
            {results.map((party, i) => (
              <li key={party.id}>
                <button
                  type="button"
                  onMouseEnter={() => setHighlight(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectParty(party.id);
                  }}
                  className={`block w-full px-2.5 py-2 text-left ${
                    i === highlight ? "bg-[var(--erp-bg)]" : "hover:bg-[var(--erp-hover)]"
                  }`}
                >
                  {party.name}
                </button>
              </li>
            ))}
            {results.length === 0 && (
              <li className="px-2.5 py-2 text-[var(--erp-text-muted)]">검색 결과가 없습니다.</li>
            )}
          </ul>,
          document.body
        )}
    </div>
  );
}
