import { DocumentTemplateForm } from "@/components/document-template-form";
import { createTemplate } from "@/app/(dashboard)/hr/documents/actions";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { CloseButton } from "@/components/erp/close-button";

export default function NewDocumentTemplatePage() {
  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/hr/documents/templates" } }} />
      <h1 className="mb-3 text-lg font-bold text-[var(--erp-text)]">인사관리 &gt; 문서 양식 관리 &gt; 새 양식</h1>

      <div className="erp-toolbar">
        <CloseButton href="/hr/documents/templates">ESC 목록으로</CloseButton>
      </div>

      <div className="erp-detail" style={{ marginTop: 0 }}>
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">양식 등록</span>
        </div>
        <div className="erp-detail-body">
          <DocumentTemplateForm action={createTemplate} submitLabel="등록" />
        </div>
      </div>
    </div>
  );
}
