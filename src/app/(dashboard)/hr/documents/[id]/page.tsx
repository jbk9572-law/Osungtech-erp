import { notFound } from "next/navigation";
import { createClient, getUser } from "@/lib/supabase/server";
import { DeleteButton } from "@/components/delete-button";
import { GridBadge } from "@/components/grid/badge";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { IssueDocumentButton } from "@/components/issue-document-button";
import { PrintInPlaceButton } from "@/components/print-in-place-button";
import { deleteDocument, issueDocument } from "@/app/(dashboard)/hr/documents/actions";

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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
      <KeyboardShortcuts shortcuts={{ F9: { printHref: `/hr/documents/${id}/print` }, Escape: { href: "/hr/documents" } }} />
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-lg font-bold text-[var(--erp-text)]">{doc.title}</h1>
        <div className="erp-toolbar" style={{ marginBottom: 0 }}>
          <PrintInPlaceButton href={`/hr/documents/${id}/print`} className="erp-btn">
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
