import { createClient } from "@/lib/supabase/server";
import { getCurrentActor } from "@/lib/current-actor";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { ListPageHeader } from "@/components/erp/page-header";
import { ApprovalDelegationForm } from "@/components/approval-delegation-form";
import { createApprovalDelegation } from "@/app/(dashboard)/settings/delegations/actions";
import { fetchAllRows } from "@/lib/fetch-all-rows";

// 새 위임 등록 입력 화면 — 목록 위 인라인 폼 대신 C형 모달/전용 화면으로 연다.
export default async function NewApprovalDelegationPage() {
  const supabase = await createClient();
  const { isAdmin } = await getCurrentActor(supabase);
  const profiles = await fetchAllRows<{ id: string; full_name: string | null }>((from, to) =>
    supabase.from("profiles").select("id, full_name").order("full_name").range(from, to),
  );
  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/settings/delegations" } }} />
      <ListPageHeader title="환경설정 > 전결권 관리 > 새 위임" />
      <ApprovalDelegationForm action={createApprovalDelegation} isAdmin={isAdmin} profiles={profiles} />
    </div>
  );
}
