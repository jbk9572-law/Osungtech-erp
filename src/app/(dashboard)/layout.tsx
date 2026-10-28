import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient, getUser } from "@/lib/supabase/server";
import { safeQuery } from "@/lib/safe-query";
import { ttlCached } from "@/lib/ttl-cache";
import { ErpShell } from "@/components/erp/erp-shell";
import { TenantUsageWidget } from "@/components/erp/tenant-usage-widget";
import { NotificationBellPanel } from "@/components/erp/notification-bell-panel";
import { MaintenanceScreen } from "@/components/erp/maintenance-screen";
import { BellIcon } from "@/components/erp/groupware-icons";
import { quotaStatusFromRpcRow, buildQuotaBannerMessage } from "@/lib/quota/tenant-quota";
import "@/app/erp-theme.css";

// get_dashboard_layout_bootstrap()(migration 197)이 돌려주는 모양 —
// 예전엔 이 8개를 각각 따로 조회했는데, 그 쿼리들이 쓰던 컬럼명을 그대로
// 키로 쓴다(별도 camelCase 변환 없음).
type LayoutBootstrap = {
  company: { name: string | null; logo_mark_url: string | null } | null;
  profile: { is_demo: boolean; role: string; department_id: string | null } | null;
  tenant: { disabled_features: string[] } | null;
  is_platform_admin: boolean;
  announcements: { id: string; title: string }[];
  platform_settings: { maintenance_mode: boolean; maintenance_message: string | null } | null;
  department_page_access: { page_key: string; department_id: string }[];
  quota: {
    db_bytes_used: number;
    db_quota_bytes: number;
    db_pct: number;
    file_bytes_used: number;
    file_quota_bytes: number;
    file_pct: number;
  } | null;
};

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
  //
  // 예전엔 이 8개를 Promise.all로 "동시에" 쐈지만, 결과적으로
  // Cloudflare Workers→Supabase REST 왕복이 8번 따로 나갔다 — 거래량이
  // 적어(하루 매출+매입 합쳐 10건 안팎) Workers 인스턴스가 자주 새로
  // 뜨는 편이라, 프로세스 내 TTL 캐시(ttlCached)도 자주 비어 있는 채로
  // 시작해서 메뉴 이동마다 이 8번의 왕복이 거의 매번 그대로 발생해
  // 체감 속도가 많이 느렸다(사용자 지적). get_dashboard_layout_bootstrap()
  // (migration 197)로 8개를 하나의 SQL 함수/왕복으로 묶었다 — 각
  // 서브쿼리는 기존에 각 테이블/RPC가 쓰던 RLS(테넌트 격리/데모 격리/
  // 플랫폼 운영자 전용 등)를 그대로 통과하므로 보이는 데이터 범위는
  // 전과 동일하다. 점검모드(platform_settings)는 "즉시 전체 잠금"이
  // 존재 이유라 캐시가 묶이면서 TTL도 전체가 더 짧은 쪽(10초)에 맞췄다
  // — 나머지 값들은 전보다 살짝 더 자주 새로 조회되지만, 8번→1번 왕복
  // 절감 효과가 훨씬 크다. 테넌트/회사 데이터는 RLS(auth.uid() 세션)로만
  // 걸러지므로 캐시 키에 반드시 user.id를 넣는다 — 그래야 다른 회사
  // 사용자끼리 절대 캐시를 공유하지 않는다.
  const LAYOUT_CACHE_TTL_MS = 10_000;
  const { data: bootstrapRaw } = await ttlCached(`layout:bootstrap:${user.id}`, LAYOUT_CACHE_TTL_MS, () =>
    safeQuery(supabase.rpc("get_dashboard_layout_bootstrap")),
  );
  const bootstrap = bootstrapRaw as LayoutBootstrap | null;

  const company = bootstrap?.company ?? null;
  const myProfile = bootstrap?.profile ?? null;
  const tenant = bootstrap?.tenant ?? null;
  const isPlatformAdmin = bootstrap?.is_platform_admin ?? false;
  const announcements = bootstrap?.announcements ?? [];
  const platformSettings = bootstrap?.platform_settings ?? null;
  const departmentPageAccessRows = bootstrap?.department_page_access ?? [];
  const quotaRow = bootstrap?.quota ?? null;

  const isDemo = myProfile?.is_demo ?? false;
  const isAdmin = myProfile?.role === "admin";
  const isManagerOrAdmin = isAdmin || myProfile?.role === "manager";

  // 부서별 접근 제한(department_page_access)이 설정된 page_key 중,
  // 관리자가 아니면서 내 부서가 허용 목록에 없는 건 트리메뉴/빠른검색/
  // 즐겨찾기에서도 숨긴다 — adminOnly 메뉴가 "disabledFeatures 배열에
  // href를 넣어 숨기는" 것과 완전히 같은 매커니즘을 재사용한다(새
  // 매개변수를 따로 안 만들어도 됨). 실제 화면 접근 차단은 각 page.tsx가
  // canViewPage()로 직접 한다 — 이건 메뉴에만 영향을 주는 UX 편의다.
  const myDepartmentId = myProfile?.department_id ?? null;
  const deniedPageKeys = isAdmin
    ? []
    : Array.from(
        (departmentPageAccessRows ?? []).reduce((byPageKey, row) => {
          if (!byPageKey.has(row.page_key)) byPageKey.set(row.page_key, []);
          byPageKey.get(row.page_key)!.push(row.department_id);
          return byPageKey;
        }, new Map<string, string[]>()),
      )
        .filter(([, departmentIds]) => !myDepartmentId || !departmentIds.includes(myDepartmentId))
        .map(([pageKey]) => pageKey);

  const disabledFeatures = [...(tenant?.disabled_features ?? []), ...deniedPageKeys];

  const quotaStatus = quotaRow ? quotaStatusFromRpcRow(quotaRow) : null;
  const quotaBanner = quotaStatus ? buildQuotaBannerMessage(quotaStatus, isAdmin) : null;

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
        <Suspense
          fallback={
            <button type="button" className="erp-bell-btn" aria-label="알림">
              <span className="erp-icon" aria-hidden style={{ width: 15, height: 15 }}>
                <BellIcon />
              </span>
            </button>
          }
        >
          <NotificationBellPanel userId={user.id} />
        </Suspense>
      }
      // 고객(테넌트 관리자)이 보는 자기 요금제 사용량만 사이드바에 둔다 —
      // "무료플랜 소진율" 같은 플랫폼 내부 인프라 현황(예전엔 여기 같이
      // 떠 있었다)은 일반 업무 화면을 돌아다니는 내내 보일 이유가 없어서
      // 플랫폼 관리 > 통계 화면으로 옮겼다(platform-admin/stats/page.tsx).
      usageWidget={isAdmin && quotaStatus ? (
        <TenantUsageWidget
          dbBytesUsed={quotaStatus.dbBytesUsed}
          dbQuotaBytes={quotaStatus.dbQuotaBytes}
          fileBytesUsed={quotaStatus.fileBytesUsed}
          fileQuotaBytes={quotaStatus.fileQuotaBytes}
          planLabel="현재 요금제"
        />
      ) : null}
      disabledFeatures={disabledFeatures}
      isAdmin={isAdmin}
      isManagerOrAdmin={isManagerOrAdmin}
      isPlatformAdmin={isPlatformAdmin === true}
      platformAnnouncements={announcements ?? []}
      quotaBanner={quotaBanner}
      modal={modal}
    >
      {children}
    </ErpShell>
  );
}
