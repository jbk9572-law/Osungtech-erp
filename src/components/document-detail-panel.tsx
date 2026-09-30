import { notFound } from "next/navigation";
import { createClient, getUser } from "@/lib/supabase/server";
import { DeleteButton } from "@/components/delete-button";
import { GridBadge } from "@/components/grid/badge";
import { IssueDocumentButton } from "@/components/issue-document-button";
import { PrintInPlaceButton } from "@/components/print-in-place-button";
import { deleteDocument, issueDocument } from "@/app/(dashboard)/hr/documents/actions";

// hr/documents/page.tsx의 목록+상세 분할 화면에서, 목록 옆 패널에 이
// 컴포넌트를 그대로 렌더링한다. 모달/직접 URL 접근
// (hr/documents/item/[id]/page.tsx)도 같은 컴포넌트를 쓴다.
export async function DocumentDetailPanel({ id }: { id: string }) {
  const supabase = await createClient();
  const user = await getUser();

  const { data: doc } = await supabase
    .from("document_instances")
    .select("id, title, rendered_body, status, created_by, created_at, issued_at, profiles!subject_user_id(full_name)")
    .eq("id", id)
    .maybeSingle();

  if (!doc) {
    notFound();
  }

  const canManage = doc.created_by === user?.id;

  return (
    <>
      <div className="mb-1 erp-detail-header-row">
        <h1 className="text-lg font-bold text-[var(--erp-text)]">{doc.title}</h1>
        <div className="erp-toolbar" style={{ marginBottom: 0 }}>
          <PrintInPlaceButton href={`/hr/documents/item/${id}/print`}>F9 인쇄</PrintInPlaceButton>
          {canManage && (
            <DeleteButton action={deleteDocument} id={id} confirmMessage="이 문서를 삭제하시겠습니까?" />
          )}
        </div>
      </div>
      <p className="mb-4 text-xs text-[var(--erp-text-muted)]">
        {doc.profiles?.full_name ? `대상: ${doc.profiles.full_name} · ` : ""}
        {new Date(doc.created_at).toLocaleString("ko-KR")} ·{" "}
        <GridBadge tone={doc.status === "issued" ? "ok" : "warn"}>{doc.status === "issued" ? "발급완료" : "초안"}</GridBadge>
      </p>

      {canManage && doc.status === "draft" && (
        <div style={{ marginBottom: 12 }}>
          <IssueDocumentButton id={id} action={issueDocument} />
        </div>
      )}

      <div className="erp-detail" style={{ marginTop: 0 }}>
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">문서 내용</span>
        </div>
        <div className="erp-detail-body">
          {/* rendered_body는 양식 작성 시 스마트에디터로 만든 HTML에
              병합필드 값을 채워 넣은 결과다 — hr/documents/actions.ts의
              renderTemplate이 값을 이스케이프해서 넣으므로 안전하다. */}
          <div
            className="erp-richtext-content"
            style={{ padding: 0, fontSize: 13.5 }}
            dangerouslySetInnerHTML={{ __html: doc.rendered_body }}
          />
        </div>
      </div>
    </>
  );
}
