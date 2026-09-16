import { createClient } from "@/lib/supabase/server";
import { getDatabaseSizeBytes, getStorageSizeBytes } from "@/lib/db-usage";
import { getVpsDiskUsage } from "@/lib/vps-usage";
import { getNetlifyUsage } from "@/lib/netlify-usage";
import { UsageWidget } from "@/components/erp/usage-widget";

// DB/스토리지/서버 사용량 조회를 (dashboard)/layout.tsx의 메인
// Promise.all에서 분리해 별도 서버 컴포넌트로 뺐다 — 예전엔 이 넷(특히
// 넷리파이 API 호출)이 느려지거나 실패하면 사이드바 전체(TreeMenu)를
// 포함한 레이아웃 전체가 같이 멈춰 있었고, 병렬 라우트(@modal) 특성상
// 모달을 열 때마다 레이아웃 함수가 다시 실행되면서 그때마다 이 위젯이
// 함께 다시 그려져 로딩 중 깜빡이거나 깨져 보이는 것처럼 보였다. 이제
// <Suspense>로 감싸 독립적으로 스트리밍되므로, 느려지거나 실패해도
// 나머지 화면(제목표시줄/트리메뉴/본문)에는 영향을 주지 않는다.
export async function UsageWidgetPanel() {
  const supabase = await createClient();
  const [dbSizeBytes, storageSizeBytes, netlifyUsage] = await Promise.all([
    getDatabaseSizeBytes(supabase),
    getStorageSizeBytes(supabase),
    getNetlifyUsage(),
  ]);
  const vpsDisk = getVpsDiskUsage();

  return (
    <UsageWidget
      dbSizeBytes={dbSizeBytes}
      storageSizeBytes={storageSizeBytes}
      vpsDisk={vpsDisk}
      netlifyUsage={netlifyUsage}
    />
  );
}
