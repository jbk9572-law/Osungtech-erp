import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/is-uuid";
import { SalesActivityDetailPanel } from "@/components/sales-activity-detail-panel";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { requireFeatureEnabled } from "@/lib/require-feature-enabled";

// 영업활동 상세·수정(C형 모달 내용) — 목록과 같은 기능(crm) 사용 여부를 직접 접근에서도 확인한다.
export default async function SalesActivityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const supabase = await createClient();
  await requireFeatureEnabled(supabase, "crm");
  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/sales-activities" } }} />
      <SalesActivityDetailPanel key={id} id={id} closeHref="/sales-activities" />
    </div>
  );
}
