import { notFound } from "next/navigation";
import { createClient, getUser } from "@/lib/supabase/server";
import { DeleteButton } from "@/components/delete-button";
import { DetailPageHeader } from "@/components/erp/page-header";
import { RichTextView } from "@/components/erp/rich-text-view";
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
      <DetailPageHeader
        title={doc.title}
        meta={
          <>
            {doc.profiles?.full_name ? `대상: ${doc.profiles.full_name} · ` : ""}
            {new Date(doc.created_at).toLocaleString("ko-KR")} ·{" "}
            <GridBadge tone={doc.status === "issued" ? "ok" : "warn"}>{doc.status === "issued" ? "발급완료" : "초안"}</GridBadge>
          </>
        }
        actions={
          <>
            <PrintInPlaceButton href={`/hr/documents/item/${id}/print`}>F9 인쇄</PrintInPlaceButton>
            {canManage && (
              <DeleteButton action={deleteDocument} id={id} confirmMessage="이 문서를 삭제하시겠습니까?" />
            )}
          </>
        }
      />

      {canManage && doc.status === "draft" && (
        <div style={{ marginBottom: "var(--erp-space-4)" }}>
          <IssueDocumentButton id={id} action={issueDocument} />
        </div>
      )}

      <div className="erp-detail" style={{ marginTop: 0 }}>
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">문서 내용</span>
        </div>
        <div className="erp-detail-body">
          {/* rendered_body는 양식 작성 시 스마트에디터로 만든 HTML에
              병합필드 값을 채워 넣은 결과다. 병합필드 값 자체는
              renderTemplate이 이스케이프해서 넣지만, 양식 본문(템플릿)
              쪽은 에디터를 거치지 않고 직접 저장될 수 있으므로
              RichTextView가 렌더링 전 한 번 더 걸러낸다. */}
          <RichTextView html={doc.rendered_body} className="erp-richtext-content" style={{ padding: 0, fontSize: 13.5 }} />
        </div>
      </div>
    </>
  );
}
