import { createClient } from "@/lib/supabase/server";
import { getCurrentActor } from "@/lib/current-actor";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { ListPageHeader, FormSection } from "@/components/erp/page-header";
import { AccessWall } from "@/components/erp/access-wall";
import { PageGuide } from "@/components/erp/page-guide";
import { SandboxTools } from "@/components/sandbox-tools";
import Link from "next/link";

export default async function SandboxSettingsPage() {
  const supabase = await createClient();
  const { isAdmin } = await getCurrentActor(supabase);

  if (!isAdmin) {
    return <AccessWall title="환경설정 > 샌드박스 도구" message="이 화면은 관리자만 볼 수 있습니다." backHref="/dashboard" />;
  }

  const { data: isSandbox } = await supabase.rpc("is_sandbox_tenant");
  // 플랫폼 운영자가 회사 전환으로 들어온 경우, 샌드박스 지정은 이 회사의 고객사 상세에서 하므로 바로 갈 수 있게 한다.
  const { data: isPlatformAdmin } = !isSandbox ? await supabase.rpc("is_platform_admin") : { data: false };
  const { data: currentTenantId } = !isSandbox && isPlatformAdmin ? await supabase.rpc("current_tenant_id") : { data: null };

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/dashboard" } }} />
      <ListPageHeader title="환경설정 > 샌드박스 도구" />

      {!isSandbox ? (
        <PageGuide tone="warning">
          이 회사는 샌드박스로 지정되지 않았습니다. 플랫폼 운영자가 플랫폼관리자 &gt; 고객사 상세에서
          「샌드박스로 지정」을 눌러야 아래 도구를 쓸 수 있습니다.
          {isPlatformAdmin === true && currentTenantId && (
            <>
              {" "}
              <Link href={`/platform-admin/${currentTenantId}`} className="erp-btn">
                이 회사의 고객사 상세로 이동
              </Link>
            </>
          )}
        </PageGuide>
      ) : (
        <>
          <PageGuide tone="danger">
            이 회사는 샌드박스로 지정돼 있습니다 — 아래 「초기화」는 로그인 계정을 뺀 모든 데이터(매출/매입/재고/
            거래처/품목 등)를 되돌릴 수 없이 지웁니다. 실제 업무 데이터가 있는 회사에서는 이 버튼이 보여도
            동작하지 않습니다(샌드박스 테넌트인지 서버에서 다시 한번 확인합니다).
          </PageGuide>
          <FormSection tabLabel="원클릭 유틸리티">
            <SandboxTools />
          </FormSection>
        </>
      )}
    </div>
  );
}
