"use client";

import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { focusNextCellInRow } from "@/lib/grid-enter-nav";

type Product = { id: string; sku: string; name: string; spec?: string | null };

export function ProductSearchSelect({
  products,
  value,
  onChange,
  placeholder = "코드, 상품명 또는 규격 검색",
}: {
  products: Product[];
  value: string;
  onChange: (productId: string) => void;
  placeholder?: string;
}) {
  const selected = products.find((p) => p.id === value) ?? null;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  // 매출/매입 등록 표는 erp-grid-wrap(overflow: auto)에 담겨 있어서, 목록을
  // 예전처럼 입력창 기준 position:absolute로 띄우면 표 아래쪽에 걸린 줄에서
  // 드롭다운이 표 바깥으로 나가는 부분이 잘려 안 보이는 문제가 있었다.
  // document.body에 포털로 렌더링하고 입력창의 화면 좌표를 계산해
  // position:fixed로 붙여서 이 문제를 피한다.
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number; width: number } | null>(
    null
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products.slice(0, 20);
    return products
      .filter(
        (p) =>
          p.sku.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q) ||
          (p.spec ?? "").toLowerCase().includes(q)
      )
      .slice(0, 20);
  }, [products, query]);

  function selectProduct(productId: string) {
    onChange(productId);
    setQuery("");
    setOpen(false);
    setHighlight(0);
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={
          open
            ? query
            : selected
              ? `${selected.sku} · ${selected.name}${selected.spec ? ` (${selected.spec})` : ""}`
              : ""
        }
        placeholder={placeholder}
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
            // 방향키로 고른 항목을 선택하고, 그리드의 "Enter=다음 행"
            // 동작으로 넘어가지 않도록 여기서 멈춘 뒤 같은 행의 다음
            // 칸(규격 등)으로 바로 넘어간다.
            e.preventDefault();
            e.stopPropagation();
            const el = inputRef.current;
            selectProduct(results[highlight].id);
            if (el) focusNextCellInRow(el);
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
            className="max-h-56 overflow-y-auto rounded-sm border border-[#d9d9d9] bg-white text-[12.5px] shadow-md"
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
                    selectProduct(product.id);
                  }}
                  className={`block w-full px-2.5 py-2 text-left ${
                    i === highlight ? "bg-[#eef1f5]" : "hover:bg-[#f3f7fc]"
                  }`}
                >
                  <span className="font-medium text-[#1c1c1c]">{product.sku}</span>
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
