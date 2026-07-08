"use client";

import { useMemo, useState } from "react";

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

  return (
    <div className="relative">
      <input
        type="text"
        value={
          open
            ? query
            : selected
              ? `${selected.sku} · ${selected.name}${selected.spec ? ` (${selected.spec})` : ""}`
              : ""
        }
        placeholder={placeholder}
        onFocus={() => {
          setQuery("");
          setOpen(true);
        }}
        onChange={(e) => setQuery(e.target.value)}
        onBlur={() => {
          setTimeout(() => setOpen(false), 150);
        }}
        className="erp-input"
        style={{ width: "100%" }}
      />
      {open && (
        <ul
          className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-sm border border-[#d9d9d9] bg-white text-[12.5px] shadow-md"
        >
          {results.map((product) => (
            <li key={product.id}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(product.id);
                  setQuery("");
                  setOpen(false);
                }}
                className="block w-full px-2.5 py-2 text-left hover:bg-[#f3f7fc]"
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
        </ul>
      )}
    </div>
  );
}
