import { requirePlatformAdmin } from "@/lib/require-platform-admin";
import { PageGuide } from "@/components/erp/page-guide";
import { ListPageHeader } from "@/components/erp/page-header";
import { FailureLogListBody } from "@/components/failure-log-list-body";

export default async function PlatformFailureLogPage() {
  const { supabase } = await requirePlatformAdmin();

  const { data: rows, error } = await supabase.rpc("get_cross_tenant_failure_log", { p_limit: 200 });

  return (
    <div>
      <ListPageHeader eyebrow="플랫폼 관리" title="실패 로그" />
      <PageGuide>
        사용자가 겪은 뮤테이션 실패(삭제가 막힘, 등록/수정 실패 등)를 CODE+한글설명으로 모아 보여줍니다(최근
        200건). 아직 매입/매출 삭제 등 핵심 뮤테이션에만 걸려 있고, 나머지 화면은 점진적으로 추가됩니다. 같은
        CODE가 반복되면 코드 자체의 설계 문제일 가능성이 높으니 눈여겨봐주세요.
      </PageGuide>

      {!rows?.length ? (
        <p className="erp-grid-empty">{error ? `조회에 실패했습니다: ${error.message}` : "표시할 실패 로그가 없습니다."}</p>
      ) : (
        <FailureLogListBody rows={rows} />
      )}
    </div>
  );
}
