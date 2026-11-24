"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useThemeFeatures } from "@/lib/erp-theme-features";
import { startRouteProgress } from "@/lib/route-progress";

// 재고관리 안의 화면들(현황·일시반출·실사·창고)을 사이드 메뉴에서 따로 찾아 들어가지 않고
// 같은 틀 안에서 탭으로 오가게 하는 줄(모던 새 틀 전용). 주소는 그대로라 기존 링크·권한·즐겨찾기가 유지된다.
const TABS = [
  { label: "재고현황", href: "/inventory", exact: true },
  { label: "일시반출", href: "/inventory/loans" },
  { label: "재고 실사", href: "/inventory/count" },
  { label: "창고", href: "/inventory/warehouses" },
] as const;

export function InventorySubTabs() {
  const { listFrameV2 } = useThemeFeatures();
  const pathname = usePathname();
  if (!listFrameV2) return null;
  return (
    <nav className="erp-subtabs" aria-label="재고관리 화면">
      {TABS.map((t) => {
        const active = "exact" in t && t.exact ? pathname === t.href : pathname === t.href || pathname.startsWith(`${t.href}/`);
        return (
          <Link key={t.href} href={t.href} className={`erp-subtab${active ? " active" : ""}`} aria-current={active ? "page" : undefined} onClick={() => !active && startRouteProgress()}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
