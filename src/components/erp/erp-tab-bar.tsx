"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TAB_LABELS: { prefix: string; label: string }[] = [
  { prefix: "/sales", label: "영업관리 - 수주관리" },
  { prefix: "/purchases", label: "구매관리 - 발주관리" },
  { prefix: "/inventory", label: "재고관리 - 재고현황" },
  { prefix: "/products", label: "품목관리 - 품목목록" },
  { prefix: "/customers", label: "거래처관리 - 판매처" },
  { prefix: "/suppliers", label: "거래처관리 - 공급처" },
  { prefix: "/warehouses", label: "거래처관리 - 창고" },
  { prefix: "/settings/company", label: "시스템관리 - 회사정보" },
];

export function ErpTabBar() {
  const pathname = usePathname();
  const match = TAB_LABELS.find((t) => pathname.startsWith(t.prefix));

  return (
    <div className="erp-tabbar">
      <Link href="/dashboard" className={`erp-tab ${pathname === "/dashboard" ? "active" : ""}`}>
        대시보드
      </Link>
      {match && (
        <span className={`erp-tab ${pathname !== "/dashboard" ? "active" : ""}`}>
          {match.label}
        </span>
      )}
    </div>
  );
}
