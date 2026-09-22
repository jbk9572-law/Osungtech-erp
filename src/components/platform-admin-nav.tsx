"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/platform-admin", label: "고객사" },
  { href: "/platform-admin/settings", label: "환경설정" },
  { href: "/platform-admin/announcements", label: "공지사항" },
  { href: "/platform-admin/activity-log", label: "활동 로그" },
  { href: "/platform-admin/plans", label: "요금제" },
  { href: "/platform-admin/stats", label: "통계" },
] as const;

// 고객사 상세(/platform-admin/[tenantId])는 목록에서 드릴다운한 화면이라
// 별도 탭이 없다 — 그 경로에 있을 때도 "고객사" 탭이 활성 상태로 보이게
// 나머지 탭 경로가 아니면 전부 고객사로 취급한다.
function isActive(pathname: string, href: string): boolean {
  if (href !== "/platform-admin") {
    return pathname === href || pathname.startsWith(`${href}/`);
  }
  return !NAV_ITEMS.some((item) => item.href !== "/platform-admin" && pathname.startsWith(item.href));
}

export function PlatformAdminNav() {
  const pathname = usePathname();

  return (
    <div className="erp-detail-tabs erp-detail-tabs-scroll" style={{ marginBottom: 16 }}>
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`erp-detail-tab${isActive(pathname, item.href) ? " active" : ""}`}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}
