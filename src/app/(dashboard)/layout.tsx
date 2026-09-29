import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient, getUser } from "@/lib/supabase/server";
import { safeQuery } from "@/lib/safe-query";
import { ErpShell } from "@/components/erp/erp-shell";
import { UsageWidgetPanel } from "@/components/erp/usage-widget-panel";
import { NotificationBellPanel } from "@/components/erp/notification-bell-panel";
import { MaintenanceScreen } from "@/components/erp/maintenance-screen";
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
  // 아래 6개 조회는 화면이 뭐든 상관없이 (dashboard) 아래 모든 페이지
  // 렌더링마다 매번 같이 도는데, safeQuery 없이 Promise.all에 그냥
  // 넣었을 때는 그중 하나만 순단(Cloudflare Workers에서 Supabase로
  // 나가는 fetch 자체가 reject되는 경우)에 걸려도 그 요청이 렌더링하려던
  // 화면이 뭐든 상관없이 레이아웃 자체가 죽었다 — 재고실사/QR라벨인쇄처럼
  // 서로 무관한 화면에서 반복 재현된 크래시가 실제로 이 Promise.all
  // 안에서 나고 있었다(Cloudflare Workers Logs로 확인: 스택이 매번
  // "Promise.all (index 3)" = is_platform_admin RPC를 가리켰다). 아래
  // 개별 주석들이 원래부터 "실패해도 안전한 기본값으로 넘어간다"고 말하고
  // 있던 설계 의도를 safeQuery로 실제로 구현한다.
  const [
    { data: company },
    { data: myProfile },
    { data: tenant },
    { data: isPlatformAdmin },
    { data: announcements },
    { data: platformSettings },
  ] = await Promise.all([
      safeQuery<{ name: string | null; logo_mark_url: string | null }>(
        supabase
          .from("company_profile")
          .select("name, logo_mark_url")
          .maybeSingle(),
      ),
      // 예전엔 메신저 위젯의 상대방 이름 표시(profileNames)까지 여기서
      // 같이 챙기느라 전 직원 프로필을 통째로 가져왔다 — 메신저가 팝업
      // 위젯에서 /messenger 전용 화면으로 옮겨가면서(그 화면이 필요할 때
      // 직접 가져옴) 여기서는 내 프로필 한 행(데모/관리자 여부 판정용)만
      // 있으면 된다.
      safeQuery<{ is_demo: boolean; role: string }>(
        supabase.from("profiles").select("is_demo, role").eq("id", user.id).maybeSingle(),
      ),
      // tenants_select_own RLS가 이미 "내 테넌트 한 행"으로만 걸러주므로
      // 별도 id 조건이 필요 없다. 멀티테넌트 전환(migration 098~) 적용
      // 전이거나 실패해도 화면 전체가 죽으면 안 되므로 그냥 빈 배열로
      // 넘어간다 — "아무 기능도 안 꺼짐"이 안전한 기본값이다.
      safeQuery<{ disabled_features: string[] }>(
        supabase.from("tenants").select("disabled_features").maybeSingle(),
      ),
      // DB/스토리지/넷리파이/VPS 사용량 위젯은 플랫폼(엘보닉스) 전체 인프라
      // 현황이라 특정 회사 직원이 볼 정보가 아니다 — 플랫폼 운영자에게만
      // 보여준다. 조회 실패해도 false로 처리해 안전하게 숨긴다.
      safeQuery(supabase.rpc("is_platform_admin")),
      // 플랫폼 운영자가 켜둔 전체 테넌트 공지(platform-admin > 공지사항,
      // migration 129) — 노출 중(is_active)인 것만, 회사 구분 없이 전부.
      // 배너 줄로 그대로 보여줄 목적이라 실제로는 몇 개 안 되지만,
      // check-pagination.mjs 안전장치 기준을 맞추기 위해 상한을 둔다.
      safeQuery(
        supabase
          .from("platform_announcements")
          .select("id, title")
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(20),
      ),
      // 점검 모드(migration 135) — 켜져 있으면 플랫폼 운영자를 제외한
      // 모든 사용자에게 실제 화면 대신 안내만 보여준다.
      safeQuery<{ maintenance_mode: boolean; maintenance_message: string | null }>(
        supabase.from("platform_settings").select("maintenance_mode, maintenance_message").eq("id", true).maybeSingle(),
      ),
    ]);

  const isDemo = myProfile?.is_demo ?? false;
  const isAdmin = myProfile?.role === "admin";
  const disabledFeatures = tenant?.disabled_features ?? [];

  if (platformSettings?.maintenance_mode && isPlatformAdmin !== true) {
    return <MaintenanceScreen message={platformSettings.maintenance_message} />;
  }

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
      usageWidget={
        isPlatformAdmin === true ? (
          <Suspense fallback={null}>
            <UsageWidgetPanel />
          </Suspense>
        ) : null
      }
      disabledFeatures={disabledFeatures}
      isAdmin={isAdmin}
      isPlatformAdmin={isPlatformAdmin === true}
      platformAnnouncements={announcements ?? []}
      modal={modal}
    >
      {children}
    </ErpShell>
  );
}
