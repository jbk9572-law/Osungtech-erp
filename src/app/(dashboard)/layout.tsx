import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient, getUser } from "@/lib/supabase/server";
import { ErpShell } from "@/components/erp/erp-shell";
import { UsageWidgetPanel } from "@/components/erp/usage-widget-panel";
import { NotificationBellPanel } from "@/components/erp/notification-bell-panel";
import { MessengerWidgetPanel } from "@/components/erp/messenger-widget-panel";
import "@/app/erp-theme.css";

export default async function DashboardLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  // company_profile/profiles/tenants(기능 on-off)는 첫 페인트에 바로
  // 필요하다(제목표시줄 회사명, 데모 배너 여부, 트리메뉴에 뭘 보여줄지) —
  // 나머지 두 개(알림 종, 메신저)는 각자 서버 컴포넌트로 빼서
  // <Suspense>로 따로 스트리밍한다(아래 usageWidget과 같은 이유) —
  // 페이지 이동마다(모달 열기 포함) 항상 같이 돌던 조회를 줄여 요청당
  // CPU 부담을 낮춘다.
  const [{ data: company }, { data: profiles }, { data: tenant }, { data: isPlatformAdmin }] = await Promise.all([
    supabase
      .from("company_profile")
      .select("name, logo_mark_url")
      .maybeSingle(),
    supabase.from("profiles").select("id, full_name, is_demo, role"),
    // tenants_select_own RLS가 이미 "내 테넌트 한 행"으로만 걸러주므로
    // 별도 id 조건이 필요 없다. 멀티테넌트 전환(migration 098~) 적용
    // 전이거나 실패해도 화면 전체가 죽으면 안 되므로 그냥 빈 배열로
    // 넘어간다 — "아무 기능도 안 꺼짐"이 안전한 기본값이다.
    supabase.from("tenants").select("disabled_features").maybeSingle(),
    // DB/스토리지/넷리파이/VPS 사용량 위젯은 플랫폼(엘보닉스) 전체 인프라
    // 현황이라 특정 회사 직원이 볼 정보가 아니다 — 플랫폼 운영자에게만
    // 보여준다. 조회 실패해도 false로 처리해 안전하게 숨긴다.
    supabase.rpc("is_platform_admin"),
  ]);

  const profileNames = Object.fromEntries(
    (profiles ?? []).map((p) => [p.id, p.full_name || "구성원"]),
  );
  const myProfile = (profiles ?? []).find((p) => p.id === user.id);
  const isDemo = myProfile?.is_demo ?? false;
  const isAdmin = myProfile?.role === "admin";
  const disabledFeatures = tenant?.disabled_features ?? [];

  return (
    <ErpShell
      isDemo={isDemo}
      companyName={company?.name}
      logoUrl={company?.logo_mark_url}
      email={user.email ?? null}
      notificationBell={
        <Suspense fallback={<button type="button" className="erp-bell-btn" aria-label="알림">🔔</button>}>
          <NotificationBellPanel userId={user.id} />
        </Suspense>
      }
      messengerWidget={
        <Suspense fallback={null}>
          <MessengerWidgetPanel profileNames={profileNames} currentUserId={user.id} isAdmin={isAdmin} />
        </Suspense>
      }
      usageWidget={
        isPlatformAdmin === true ? (
          <Suspense fallback={null}>
            <UsageWidgetPanel />
          </Suspense>
        ) : null
      }
      disabledFeatures={disabledFeatures}
      isAdmin={isAdmin}
      modal={modal}
    >
      {children}
    </ErpShell>
  );
}
