import { createClient } from "@/lib/supabase/server";
import { OfficialDocumentForm } from "@/components/official-document-form";
import { createOfficialDocument } from "@/app/(dashboard)/official-documents/actions";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { CloseButton } from "@/components/erp/close-button";
import { fetchAllRows } from "@/lib/fetch-all-rows";

export default async function NewOfficialDocumentPage() {
  const supabase = await createClient();

  const [templates, profiles] = await Promise.all([
    fetchAllRows<{ id: string; name: string; body: string }>((from, to) =>
      supabase
        .from("document_templates")
        .select("id, name, body")
        .eq("category", "official")
        .eq("is_active", true)
        .order("name")
        .range(from, to),
    ),
    fetchAllRows<{ id: string; full_name: string | null }>((from, to) =>
      supabase.from("profiles").select("id, full_name").order("full_name").range(from, to),
    ),
  ]);

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/official-documents" } }} />
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-[var(--erp-text)]">공문관리 &gt; 새 공문</h1>
        <CloseButton href="/official-documents">ESC 목록으로</CloseButton>
      </div>

      <div className="erp-detail" style={{ marginTop: 0 }}>
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">공문 작성</span>
        </div>
        <div className="erp-detail-body">
          <OfficialDocumentForm
            action={createOfficialDocument}
            templates={templates}
            profiles={profiles.map((p) => ({ id: p.id, name: p.full_name || "구성원" }))}
          />
        </div>
      </div>
    </div>
  );
}
