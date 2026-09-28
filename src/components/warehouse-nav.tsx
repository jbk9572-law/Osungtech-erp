"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// 창고 관리(마스터: 창고 목록)와 창고 이동(거래 이력)은 원래 트리메뉴에
// 따로 있던 화면이었는데, "두 화면이 단절돼 보인다"는 지적으로 하나의
// 화면처럼 보이게 묶었다 — 플랫폼 관리 화면(PlatformAdminNav)이 이미 쓰고
// 있는, "서로 다른 라우트를 탭처럼 이어붙이는" 패턴을 그대로 재사용한다.
// 데이터/서버 액션/RLS는 지금 그대로 완전히 분리돼 있고, 합친 건 이
// 탭 바뿐이다.
const NAV_ITEMS = [
  { href: "/inventory/warehouses", label: "창고 목록" },
  { href: "/inventory/transfers", label: "창고 이동 이력" },
] as const;

export function WarehouseNav() {
  const pathname = usePathname();

  return (
    <div className="erp-detail-tabs" style={{ marginBottom: 16 }}>
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`erp-detail-tab${pathname.startsWith(item.href) ? " active" : ""}`}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}
