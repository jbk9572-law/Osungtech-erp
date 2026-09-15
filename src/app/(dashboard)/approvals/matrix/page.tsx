import { createClient } from "@/lib/supabase/server";
import { getCurrentActor } from "@/lib/current-actor";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { ListPageHeader } from "@/components/erp/page-header";
import { PageGuide } from "@/components/erp/page-guide";
import { CloseButton } from "@/components/erp/close-button";
import { ApprovalMatrixRuleSelect } from "@/components/approval-matrix-rule-select";
import { setApprovalMatrixRule } from "@/app/(dashboard)/approvals/matrix/actions";
import { fetchAllRows } from "@/lib/fetch-all-rows";

export default async function ApprovalMatrixPage() {
  const supabase = await createClient();
  const { isAdmin } = await getCurrentActor(supabase);

  const [templates, presets, rules] = await Promise.all([
    fetchAllRows<{ id: string; name: string }>((from, to) =>
      supabase.from("document_templates").select("id, name").eq("category", "approval").eq("is_active", true).order("name").range(from, to),
    ),
    fetchAllRows<{ id: string; name: string }>((from, to) =>
      supabase.from("approval_line_presets").select("id, name").order("name").range(from, to),
    ),
    fetchAllRows<{ template_id: string; preset_id: string }>((from, to) =>
      supabase.from("approval_matrix_rules").select("template_id, preset_id").range(from, to),
    ),
  ]);

  const presetIdByTemplate: Record<string, string> = {};
  for (const r of rules) presetIdByTemplate[r.template_id] = r.preset_id;

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/approvals" } }} />
      <ListPageHeader title="전자결재 > 결재매트릭스" actions={<CloseButton href="/approvals">ESC 기안함으로</CloseButton>} />

      <PageGuide>
        결재양식(전자결재 양식으로 등록된 문서 템플릿)마다 자동으로 연결할
        결재선을 지정합니다. 기안 작성 화면에서 이 양식을 고르면 여기서
        지정한 결재선이 자동으로 채워져 제안되며, 기안자가 여전히 자유롭게
        바꿀 수 있습니다. 관리자만 변경할 수 있습니다.
      </PageGuide>

      {templates.length === 0 ? (
        <p className="erp-grid-empty">전자결재용 문서 양식(양식관리 &gt; 분류 &quot;전자결재&quot;)이 없습니다.</p>
      ) : (
        <div className="erp-grid-wrap">
          <table className="erp-grid">
            <thead>
              <tr>
                <th>결재양식</th>
                <th style={{ width: 220 }}>연결된 결재선</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id}>
                  <td>{t.name}</td>
                  <td>
                    {isAdmin ? (
                      <ApprovalMatrixRuleSelect
                        templateId={t.id}
                        presetId={presetIdByTemplate[t.id] ?? ""}
                        presets={presets}
                        action={setApprovalMatrixRule}
                      />
                    ) : (
                      presets.find((p) => p.id === presetIdByTemplate[t.id])?.name ?? "연결 안 함"
                    )}
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
