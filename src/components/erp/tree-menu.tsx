"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type LeafItem = { label: string; href?: string };
type GroupItem = { label: string; items: LeafItem[] };

const TREE: GroupItem[] = [
  { label: "메인 대시보드", items: [{ label: "홈", href: "/dashboard" }] },
  {
    label: "영업관리",
    items: [
      { label: "수주관리", href: "/sales" },
      { label: "견적관리" },
      { label: "출하지시" },
      { label: "세금계산서" },
    ],
  },
  {
    label: "구매관리",
    items: [
      { label: "발주관리", href: "/purchases" },
      { label: "입고관리" },
    ],
  },
  {
    label: "재고관리",
    items: [{ label: "재고현황 / 재고조정", href: "/inventory" }],
  },
  { label: "품목관리", items: [{ label: "품목관리", href: "/products" }] },
  { label: "생산관리", items: [{ label: "작업지시" }] },
  {
    label: "거래처관리",
    items: [
      { label: "판매처관리", href: "/customers" },
      { label: "공급처관리", href: "/suppliers" },
    ],
  },
  { label: "회계관리", items: [{ label: "전표관리" }] },
  { label: "CRM", items: [{ label: "고객상담" }] },
  { label: "인사관리", items: [{ label: "사원관리" }] },
  { label: "보고서", items: [{ label: "영업분석" }] },
  {
    label: "환경설정",
    items: [{ label: "회사정보", href: "/settings/company" }],
  },
  { label: "시스템관리", items: [{ label: "권한관리" }] },
  {
    label: "확장모듈",
    items: [
      { label: "Paper Nesting" },
      { label: "Barcode" },
      { label: "RFID" },
      { label: "PDA" },
      { label: "AI Analytics" },
    ],
  },
];

export function TreeMenu() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const group of TREE) {
      initial[group.label] = group.items.some((i) => i.href && pathname.startsWith(i.href));
    }
    return initial;
  });

  return (
    <nav className={`erp-tree${collapsed ? " collapsed" : ""}`}>
      <button
        type="button"
        className="erp-tree-toggle"
        onClick={() => setCollapsed((c) => !c)}
        title={collapsed ? "메뉴 펼치기" : "메뉴 접기"}
      >
        {collapsed ? "»" : "« 메뉴 접기"}
      </button>

      {TREE.map((group) => {
        const hasLinks = group.items.some((i) => i.href);
        const isOpen = openGroups[group.label];
        return (
          <div className="erp-tree-group" key={group.label}>
            <button
              type="button"
              className={`erp-tree-group-label${hasLinks ? "" : " disabled"}`}
              onClick={() =>
                setOpenGroups((prev) => ({ ...prev, [group.label]: !prev[group.label] }))
              }
            >
              <span className="erp-tree-caret">{isOpen ? "▾" : "▸"}</span>
              {!collapsed && <span>{group.label}</span>}
            </button>
            {isOpen && !collapsed && (
              <div className="erp-tree-children">
                {group.items.map((item) => {
                  if (!item.href) {
                    return (
                      <span className="erp-tree-item disabled" key={item.label}>
                        {item.label}
                        <span className="erp-tree-badge">준비중</span>
                      </span>
                    );
                  }
                  const active = pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.label}
                      href={item.href}
                      className={`erp-tree-item${active ? " active" : ""}`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
