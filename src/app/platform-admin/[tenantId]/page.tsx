import { isUuid } from "@/lib/is-uuid";
import { notFound } from "next/navigation";
import { TenantDetailPanel } from "@/components/tenant-detail-panel";
import { PageGuide } from "@/components/erp/page-guide";
import { resolveBackHref } from "@/lib/list-return";

// 고객사 목록(/platform-admin)에서 분할뷰 오른쪽에 뜨는 상세와 같은
// 내용을, 직접 URL로 들어오거나(북마크 등) 좁은 화면(.erp-split3-shell이
// 사이드바/목록을 숨기는 모바일)에서 전체 화면으로 볼 때 쓰는 경로다 —
// quotes/[id]와 같은 패턴.
export default async function PlatformAdminTenantDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<{ back?: string }>;
}) {
  const { tenantId } = await params;
  if (!isUuid(tenantId)) notFound();
  const { back } = await searchParams;
  const closeHref = resolveBackHref("/platform-admin", back);

  return (
    <div>
      <PageGuide>이 회사의 정보 수정, 로그인 허용 여부, 요금제 상태, 소속 계정을 관리합니다.</PageGuide>
      <TenantDetailPanel tenantId={tenantId} closeHref={closeHref} />
    </div>
  );
}
