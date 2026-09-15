import { createClient, getUser } from "@/lib/supabase/server";
import { ApprovalDocumentForm } from "@/components/approval-document-form";
import { submitApprovalDocument } from "@/app/(dashboard)/approvals/actions";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { CloseButton } from "@/components/erp/close-button";
import { fetchAllRows } from "@/lib/fetch-all-rows";

export default async function NewApprovalDocumentPage() {
  const supabase = await createClient();
  const user = await getUser();

  const allProfiles = await fetchAllRows<{ id: string; full_name: string | null }>((from, to) =>
    supabase.from("profiles").select("id, full_name").order("full_name").range(from, to),
  );
  // 본인을 본인 결재선에 넣는 건 의미가 없으므로 후보에서 제외한다.
  const approvers = allProfiles.filter((p) => p.id !== user?.id);

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/approvals" } }} />
      <h1 className="mb-3 text-lg font-bold text-[var(--erp-text)]">전자결재 &gt; 기안</h1>

      <div className="erp-toolbar">
        <CloseButton href="/approvals">ESC 목록으로</CloseButton>
      </div>

      <div className="erp-detail" style={{ marginTop: 0 }}>
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">기안서 작성</span>
        </div>
        <div className="erp-detail-body">
          <ApprovalDocumentForm action={submitApprovalDocument} approvers={approvers} />
        </div>
      </div>
    </div>
  );
}
