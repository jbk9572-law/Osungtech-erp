import { redirect } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/require-platform-admin";
import { PlatformAdminNav } from "@/components/platform-admin-nav";
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
    <div className="erp" style={{ minHeight: "100vh", background: "var(--erp-bg)" }}>
      <div style={{ maxWidth: 880, margin: "0 auto", padding: "40px 20px" }}>
        <PlatformAdminNav />
        {children}
      </div>
    </div>
  );
}
