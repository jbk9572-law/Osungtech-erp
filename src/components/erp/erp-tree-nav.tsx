"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type Leaf = { label: string; href: string };
type Group = { label: string; children: Leaf[] };

const TREE: Group[] = [
  {
    label: "영업관리",
    children: [{ label: "수주관리", href: "/sales" }],
  },
  {
    label: "구매관리",
    children: [{ label: "발주관리", href: "/purchases" }],
  },
  {
    label: "재고관리",
    children: [{ label: "재고현황", href: "/inventory" }],
  },
  {
    label: "품목관리",
    children: [{ label: "품목목록", href: "/products" }],
  },
  {
    label: "거래처관리",
    children: [
      { label: "판매처", href: "/customers" },
      { label: "공급처", href: "/suppliers" },
      { label: "창고", href: "/warehouses" },
    ],
  },
  {
    label: "시스템관리",
    children: [{ label: "회사정보", href: "/settings/company" }],
  },
];

export function ErpTreeNav() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  return (
    <nav className="erp-tree" aria-label="메인메뉴 트리">
      <div className="erp-tree-title">메인메뉴</div>

      <Link
        href="/dashboard"
        className={`erp-tree-node top ${pathname === "/dashboard" ? "active leaf" : ""}`}
      >
        <span className="erp-arrow" />
        대시보드
      </Link>

      {TREE.map((group) => {
        const isCollapsed = collapsed[group.label];
        return (
          <div key={group.label}>
            <div
              className="erp-tree-node top"
              onClick={() =>
                setCollapsed((prev) => ({ ...prev, [group.label]: !prev[group.label] }))
              }
            >
              <span className="erp-arrow">{isCollapsed ? "▸" : "▾"}</span>
              {group.label}
            </div>
            {!isCollapsed &&
              group.children.map((leaf) => {
                const isActive = pathname.startsWith(leaf.href);
                return (
                  <Link
                    key={leaf.href}
                    href={leaf.href}
                    className={`erp-tree-node leaf ${isActive ? "active" : ""}`}
                  >
                    {leaf.label}
                  </Link>
                );
              })}
          </div>
        );
      })}
    </nav>
  );
}
