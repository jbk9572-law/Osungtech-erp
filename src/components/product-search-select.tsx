"use client";

import { useMemo, useState } from "react";

type Product = { id: string; sku: string; name: string };

export function ProductSearchSelect({
  products,
  value,
  onChange,
  placeholder = "코드 또는 상품명 검색",
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
        (p) => p.sku.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)
      )
      .slice(0, 20);
  }, [products, query]);

  return (
    <div className="relative">
      <input
        type="text"
        value={open ? query : selected ? `${selected.sku} · ${selected.name}` : ""}
        placeholder={placeholder}
        onFocus={() => {
          setQuery("");
          setOpen(true);
        }}
        onChange={(e) => setQuery(e.target.value)}
        onBlur={() => {
          setTimeout(() => setOpen(false), 150);
        }}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
      {open && (
        <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-gray-200 bg-white text-sm shadow-lg">
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
                className="block w-full px-3 py-2 text-left hover:bg-gray-100"
              >
                <span className="font-medium text-gray-900">{product.sku}</span>
                <span className="ml-2 text-gray-500">{product.name}</span>
              </button>
            </li>
          ))}
          {results.length === 0 && (
            <li className="px-3 py-2 text-gray-400">검색 결과가 없습니다.</li>
          )}
        </ul>
      )}
    </div>
  );
}
