"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard", label: "대시보드" },
  { href: "/products", label: "상품" },
  { href: "/inventory", label: "재고" },
  { href: "/purchases", label: "매입(입고)" },
  { href: "/sales", label: "판매(거래명세표)" },
  { href: "/customers", label: "거래처" },
  { href: "/suppliers", label: "공급업체" },
  { href: "/warehouses", label: "창고" },
  { href: "/settings/company", label: "회사 정보" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-56 shrink-0 border-r border-gray-200 bg-white sm:block print:hidden">
      <div className="px-4 py-5">
        <span className="text-lg font-semibold text-gray-900">Osungtech ERP</span>
      </div>
      <nav className="flex flex-col gap-1 px-2">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-gray-900 text-white"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
