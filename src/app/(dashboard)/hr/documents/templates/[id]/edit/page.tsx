import { notFound } from "next/navigation";
import { isUuid } from "@/lib/is-uuid";
import { createClient } from "@/lib/supabase/server";
import { DocumentTemplateForm } from "@/components/document-template-form";
import { updateTemplate } from "@/app/(dashboard)/hr/documents/actions";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { CloseButton } from "@/components/erp/close-button";
import { ListPageHeader, FormSection } from "@/components/erp/page-header";

export default async function EditDocumentTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
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
      <ListPageHeader
        title="그룹웨어 > 문서 양식 관리 > 수정"
        actions={<CloseButton href="/hr/documents/templates">ESC 목록으로</CloseButton>}
      />

      <div className="erp-comm-shell">
        <FormSection tabLabel="양식 수정">
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
        </FormSection>
      </div>
    </div>
  );
}
