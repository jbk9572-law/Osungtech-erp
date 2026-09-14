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

  // company_profile/profiles는 첫 페인트에 바로 필요하다(제목표시줄 회사명,
  // 데모 배너 여부)ㅡ 나머지 두 개(알림 종, 메신저)는 각자 서버 컴포넌트로
  // 빼서 <Suspense>로 따로 스트리밍한다(아래 usageWidget과 같은 이유) —
  // 페이지 이동마다(모달 열기 포함) 항상 같이 돌던 조회를 줄여 요청당
  // CPU 부담을 낮춘다.
  const [{ data: company }, { data: profiles }] = await Promise.all([
    supabase
      .from("company_profile")
      .select("name, logo_mark_url")
      .maybeSingle(),
    supabase.from("profiles").select("id, full_name, is_demo"),
  ]);

  const profileNames = Object.fromEntries(
    (profiles ?? []).map((p) => [p.id, p.full_name || "구성원"]),
  );
  const isDemo = (profiles ?? []).find((p) => p.id === user.id)?.is_demo ?? false;

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
          <MessengerWidgetPanel profileNames={profileNames} currentUserId={user.id} />
        </Suspense>
      }
      usageWidget={
        <Suspense fallback={null}>
          <UsageWidgetPanel />
        </Suspense>
      }
      modal={modal}
    >
      {children}
    </ErpShell>
  );
}
