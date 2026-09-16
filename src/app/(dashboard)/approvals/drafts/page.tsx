import Link from "next/link";
import { createClient, getUser } from "@/lib/supabase/server";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { ListPageHeader } from "@/components/erp/page-header";
import { PageGuide } from "@/components/erp/page-guide";
import { CloseButton } from "@/components/erp/close-button";
import { InlineConfirmDelete } from "@/components/inline-confirm-delete";
import { deleteApprovalDraft } from "@/app/(dashboard)/approvals/actions";

export default async function ApprovalDraftsPage() {
  const supabase = await createClient();
  const user = await getUser();

  // RLS(approval_documents_select)가 created_by=본인 조건을 이미 걸어주지만,
  // 임시저장은 오직 본인만 봐야 하는 화면이라 쿼리에도 명시적으로 조건을
  // 반복해서 걸어둔다.
  const { data: drafts } = user
    ? await supabase
        .from("approval_documents")
        .select("id, title, created_at")
        .eq("status", "draft")
        .eq("created_by", user.id)
        .order("created_at", { ascending: false })
        .limit(200)
    : { data: [] };

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/approvals" } }} />
      <ListPageHeader title="전자결재 > 임시저장함" actions={<CloseButton href="/approvals">ESC 기안함으로</CloseButton>} />

      <PageGuide>
        결재선을 아직 확정하지 않고 저장해둔 문서입니다. 이어 쓰거나
        제출하기 전까지는 결재자에게 보이지 않습니다.
      </PageGuide>

      {!drafts || drafts.length === 0 ? (
        <p className="erp-grid-empty">임시저장된 문서가 없습니다.</p>
      ) : (
        <div className="erp-grid-wrap">
          <table className="erp-grid">
            <thead>
              <tr>
                <th style={{ width: 130 }}>마지막 저장</th>
                <th>제목</th>
                <th style={{ width: 190 }} />
              </tr>
            </thead>
            <tbody>
              {drafts.map((d) => (
                <tr key={d.id}>
                  <td>{new Date(d.created_at).toLocaleString("ko-KR")}</td>
                  <td>{d.title || "(제목 없음)"}</td>
                  <td>
                    <div className="flex items-center gap-1">
                      <Link
                        href={`/approvals/new?draft=${d.id}`}
                        className="erp-btn erp-btn-primary"
                        style={{ minWidth: 0, height: 24, padding: "0 8px", fontSize: 11 }}
                      >
                        이어 쓰기
                      </Link>
                      <InlineConfirmDelete
                        action={deleteApprovalDraft}
                        hiddenFields={{ id: d.id }}
                        warningText="이 임시저장 문서를 삭제하시겠습니까?"
                        triggerStyle={{ minWidth: 0, height: 24, padding: "0 8px", fontSize: 11 }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
