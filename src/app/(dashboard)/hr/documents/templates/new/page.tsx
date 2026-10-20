import { DocumentTemplateForm } from "@/components/document-template-form";
import { createTemplate } from "@/app/(dashboard)/hr/documents/actions";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { CloseButton } from "@/components/erp/close-button";
import { ListPageHeader, FormSection } from "@/components/erp/page-header";

export default function NewDocumentTemplatePage() {
  return (
    <div className="erp-comm-shell">
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/hr/documents/templates" } }} />
      <ListPageHeader
        title="그룹웨어 > 문서 양식 관리 > 새 양식"
        actions={<CloseButton href="/hr/documents/templates">ESC 목록으로</CloseButton>}
      />

      <div>
        <FormSection tabLabel="양식 등록">
          <DocumentTemplateForm action={createTemplate} submitLabel="등록" />
        </FormSection>
      </div>
    </div>
  );
}
