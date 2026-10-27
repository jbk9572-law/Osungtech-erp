import { redirect } from "next/navigation";
import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/require-platform-admin";
import { PlatformAdminNav, PlatformAdminSideNav } from "@/components/platform-admin-nav";
import "@/app/erp-theme.css";

// 플랫폼 관리자 화면 전체(고객사/환경설정/공지사항/활동로그/요금제/통계)가
// 공유하는 레이아웃 — 권한 체크와 바깥 래퍼를 여기서 한 번만 하고, 하위
// 페이지들은 각자의 내용에만 집중한다(예전엔 각 page.tsx가 이 가드와
// 래퍼를 각각 복붙하고 있었다).
export default async function PlatformAdminLayout({ children }: { children: React.ReactNode }) {
  const { isPlatformAdmin } = await requirePlatformAdmin();
  if (!isPlatformAdmin) {
    redirect("/login");
  }

  return (
    <div className="erp erp-comm-shell" style={{ minHeight: "100vh", background: "var(--erp-bg)" }}>
      <div className="erp-platform-admin-shell">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs" style={{ color: "var(--erp-text-muted)" }}>
            플랫폼 관리자
          </span>
          {/* platform-admin은 (dashboard) 레이아웃 밖의 독립된 화면이라
              왼쪽 메뉴/타이틀바가 없다 — 원래 회사 화면(대시보드)으로
              돌아갈 방법이 이 링크뿐이라 모든 하위 화면에서 항상 보이게
              레이아웃에 둔다. */}
          <Link href="/dashboard" className="erp-btn">
            메인 화면으로
          </Link>
        </div>
        {/* 모바일 전용 가로 탭(PlatformAdminNav)은 세로 메뉴 칸 밖, 전체
            폭에 둬야 좁은 화면에서 옆으로 밀리지 않는다 — 아래
            .erp-platform-admin-body(PlatformAdminSideNav)는 데스크톱
            세로 메뉴만 담당하고 둘 다 CSS 미디어 쿼리로 한쪽만 보인다. */}
        <PlatformAdminNav />
        <div className="erp-platform-admin-body">
          <PlatformAdminSideNav />
          <div className="erp-platform-admin-content">{children}</div>
        </div>
      </div>
    </div>
  );
}
