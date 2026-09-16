import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DocumentTemplateForm } from "@/components/document-template-form";
import { updateTemplate } from "@/app/(dashboard)/hr/documents/actions";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { CloseButton } from "@/components/erp/close-button";

export default async function EditDocumentTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: template } = await supabase
    .from("document_templates")
    .select("id, name, body, category, is_active")
    .eq("id", id)
    .maybeSingle();

  if (!template) {
    notFound();
  }

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/hr/documents/templates" } }} />
      <h1 className="mb-3 text-lg font-bold text-[var(--erp-text)]">인사관리 &gt; 문서 양식 관리 &gt; 수정</h1>

      <div className="erp-toolbar">
        <CloseButton href="/hr/documents/templates">ESC 목록으로</CloseButton>
      </div>

      <div className="erp-detail" style={{ marginTop: 0 }}>
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">양식 수정</span>
        </div>
        <div className="erp-detail-body">
          <DocumentTemplateForm
            action={updateTemplate}
            submitLabel="저장"
            initial={{
              id: template.id,
              name: template.name,
              body: template.body,
              category: template.category,
              isActive: template.is_active,
            }}
          />
        </div>
      </div>
    </div>
  );
}
