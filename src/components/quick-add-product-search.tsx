"use client";

import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Product = { id: string; sku: string; name: string; spec?: string | null };

// "+ 품목 추가"로 빈 줄을 먼저 만들고 그 줄 안에서 다시 검색하는 2단계
// 대신, 검색창 하나에 바로 입력하고 Enter(또는 클릭)만 하면 그 품목이
// 담긴 새 줄이 바로 생기는 빠른 추가 입력창. 추가한 뒤에도 검색창에
// 포커스가 남아있어서 여러 품목을 연달아 빠르게 넣을 수 있다 —
// ProductSearchSelect(줄 안에서 값을 바꾸는 용도)와 달리 이 입력창
// 자체는 "선택된 값"을 갖지 않고 매번 비워진다.
export function QuickAddProductSearch({
  products,
  onAdd,
  placeholder = "품목 검색 후 Enter로 바로 추가",
}: {
  products: Product[];
  onAdd: (productId: string) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number; width: number } | null>(
    null
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter(
        (p) =>
          p.sku.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q) ||
          (p.spec ?? "").toLowerCase().includes(q)
      )
      .slice(0, 20);
  }, [products, query]);

  function pick(productId: string) {
    onAdd(productId);
    setQuery("");
    setOpen(false);
    setHighlight(0);
    inputRef.current?.focus();
  }

  return (
    <div className="relative" style={{ minWidth: 240, flex: "1 1 240px" }}>
      <input
        ref={inputRef}
        type="text"
        value={query}
        placeholder={placeholder}
        onFocus={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setDropdownRect({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 280) });
          setOpen(true);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setHighlight(0);
          setOpen(true);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (!open || results.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((i) => Math.min(i + 1, results.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter" && results[highlight]) {
            e.preventDefault();
            pick(results[highlight].id);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        className="erp-input"
        style={{ width: "100%" }}
      />
      {open &&
        query.trim() &&
        dropdownRect &&
        typeof document !== "undefined" &&
        createPortal(
          <ul
            className="max-h-56 overflow-y-auto rounded-sm border border-[#e2e5eb] bg-white text-[12.5px] shadow-md"
            style={{
              position: "fixed",
              top: dropdownRect.top,
              left: dropdownRect.left,
              width: dropdownRect.width,
              zIndex: 1000,
            }}
          >
            {results.map((product, i) => (
              <li key={product.id}>
                <button
                  type="button"
                  onMouseEnter={() => setHighlight(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(product.id);
                  }}
                  className={`block w-full px-2.5 py-2 text-left ${
                    i === highlight ? "bg-[#eef1f5]" : "hover:bg-[#f3f7fc]"
                  }`}
                >
                  <span className="font-medium text-[#182338]">{product.sku}</span>
                  <span className="ml-2 text-[#6b7280]">
                    {product.name}
                    {product.spec ? ` (${product.spec})` : ""}
                  </span>
                </button>
              </li>
            ))}
            {results.length === 0 && (
              <li className="px-2.5 py-2 text-[#9aa2ad]">검색 결과가 없습니다.</li>
            )}
          </ul>,
          document.body
        )}
    </div>
  );
}
