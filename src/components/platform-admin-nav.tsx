"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/platform-admin", label: "고객사" },
  { href: "/platform-admin/plans", label: "요금제" },
  { href: "/platform-admin/announcements", label: "공지사항" },
  { href: "/platform-admin/stats", label: "통계" },
  { href: "/platform-admin/settings", label: "환경설정" },
  { href: "/platform-admin/activity-log", label: "활동 로그" },
  { href: "/platform-admin/support", label: "고객지원" },
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

// 좁은 화면(태블릿 세로 768px 미만) 전용 — 세로 메뉴(PlatformAdminSideNav)는
// 폭을 다 잡아먹어 모바일에 안 맞아서, 기존 가로 스크롤 탭으로 둔다.
// 콘텐츠 영역(.erp-platform-admin-body) 바깥, 전체 폭에 둬야 한다 —
// layout.tsx 참고. CSS(.erp-platform-admin-tabs-mobile)가 768px 밑에서만
// 보이게 한다.
export function PlatformAdminNav() {
  const pathname = usePathname();

  return (
    <div
      className="erp-comm-tabs erp-comm-tabs-scroll erp-platform-admin-tabs-mobile"
      style={{ marginBottom: "var(--erp-space-5)" }}
    >
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`erp-comm-tab${isActive(pathname, item.href) ? " active" : ""}`}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}

// 데스크톱(태블릿 세로 768px 이상) 전용 — 와이드 레이아웃에서 가로 탭이
// 왜소해 보여 그누보드류 관리자 페이지처럼 왼쪽 세로 메뉴로 바꿨다.
// 새 모양을 만들지 않고 다른 분할뷰 화면(공지사항 등)의 "분류 필터"
// 사이드바와 같은 .erp-cat-sidebar/.erp-cat-item을 재사용한다.
export function PlatformAdminSideNav() {
  const pathname = usePathname();

  return (
    <nav className="erp-cat-sidebar erp-platform-admin-sidenav">
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`erp-cat-item${isActive(pathname, item.href) ? " active" : ""}`}
        >
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
