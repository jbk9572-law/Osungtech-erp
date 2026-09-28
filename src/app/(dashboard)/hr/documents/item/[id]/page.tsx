import { notFound } from "next/navigation";
import { isUuid } from "@/lib/is-uuid";
import { createClient, getUser } from "@/lib/supabase/server";
import { DeleteButton } from "@/components/delete-button";
import { GridBadge } from "@/components/grid/badge";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { IssueDocumentButton } from "@/components/issue-document-button";
import { PrintInPlaceButton } from "@/components/print-in-place-button";
import { deleteDocument, issueDocument } from "@/app/(dashboard)/hr/documents/actions";

// 주소가 /hr/documents/item/[id]인 이유: inventory/item/[productId]와
// 같다 — /hr/documents 하위의 정적 형제 메뉴(templates)와 이 동적
// 세그먼트가 예전엔 같은 층에 있어서 @modal 인터셉트 라우트가 "templates"를
// 문서 id로 착각해 가로채는 문제가 있었다. item/ 한 단계로 완전히
// 분리했다.
export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
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
    <div>
      <KeyboardShortcuts shortcuts={{ F9: { printHref: `/hr/documents/item/${id}/print` }, Escape: { href: "/hr/documents" } }} />
      <div className="mb-1 erp-detail-header-row">
        <h1 className="text-lg font-bold text-[var(--erp-text)]">{doc.title}</h1>
        <div className="erp-toolbar" style={{ marginBottom: 0 }}>
          <PrintInPlaceButton href={`/hr/documents/item/${id}/print`}>
            F9 인쇄
          </PrintInPlaceButton>
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
          <div style={{ whiteSpace: "pre-wrap", fontSize: 13.5, lineHeight: 1.7 }}>{doc.rendered_body}</div>
        </div>
      </div>
    </div>
  );
}
