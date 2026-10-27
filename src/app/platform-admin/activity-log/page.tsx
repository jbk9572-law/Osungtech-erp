import { requirePlatformAdmin } from "@/lib/require-platform-admin";
import { PageGuide } from "@/components/erp/page-guide";
import { ListPageHeader } from "@/components/erp/page-header";
import { ActivityLogListBody } from "@/components/activity-log-list-body";

export default async function PlatformActivityLogPage() {
  const { supabase } = await requirePlatformAdmin();

  const { data: rows, error } = await supabase.rpc("get_cross_tenant_activity_log", { p_limit: 200 });

  return (
    <div>
      <ListPageHeader eyebrow="플랫폼 관리" title="활동 로그" />
      <PageGuide>
        전체 테넌트를 넘나드는 최근 활동 로그입니다(최근 200건). 각 회사가 개별적으로 보는 감사
        로그와 달리, 회사 구분 없이 전체를 훑어볼 때만 씁니다. 왼쪽에서 회사를 고르면 그 회사
        것만 걸러서 봅니다.
      </PageGuide>

      {!rows?.length ? (
        <p className="erp-grid-empty">{error ? `조회에 실패했습니다: ${error.message}` : "표시할 활동 로그가 없습니다."}</p>
      ) : (
        <ActivityLogListBody rows={rows} />
      )}
    </div>
  );
}
