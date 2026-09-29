import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentActor } from "@/lib/current-actor";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { ListPageHeader } from "@/components/erp/page-header";
import { PageGuide } from "@/components/erp/page-guide";
import { CloseButton } from "@/components/erp/close-button";
import { InlineConfirmDelete } from "@/components/inline-confirm-delete";
import { ApprovalMatrixRuleSelect } from "@/components/approval-matrix-rule-select";
import { deleteApprovalLinePreset } from "@/app/(dashboard)/approvals/lines/actions";
import { setApprovalMatrixRule } from "@/app/(dashboard)/approvals/matrix/actions";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { requireFeatureEnabled } from "@/lib/require-feature-enabled";

// 공유 결재선(누가 결재하는지)과 결재매트릭스(어느 양식이 어느 결재선을
// 자동으로 쓰는지)가 전에는 별도 화면이었는데, 둘 다 소규모 설정
// 화면이고 항상 붙어 다니는 개념이라(매트릭스가 결재선 목록을 그대로
// 참조) 탭 하나로 합쳤다(감사에서 지적됨 — 화면 통폐합).
const TABS = [
  { key: "lines", label: "공유 결재선", href: "/approvals/lines" },
  { key: "matrix", label: "결재매트릭스", href: "/approvals/lines?tab=matrix" },
] as const;

export default async function ApprovalLinesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const activeTab = tab === "matrix" ? "matrix" : "lines";

  const supabase = await createClient();
  await requireFeatureEnabled(supabase, "approvals");

  const header = (title: string) => (
    <ListPageHeader
      title={`전자결재 > ${title}`}
      actions={
        <>
          {activeTab === "lines" && (
            <Link href="/approvals/lines/new" className="erp-btn erp-btn-primary">
              F2 새 결재선
            </Link>
          )}
          <CloseButton href="/approvals">ESC 기안함으로</CloseButton>
        </>
      }
    />
  );

  const tabs = (
    <div className="erp-detail-tabs" style={{ marginBottom: 12 }}>
      {TABS.map((t) => (
        <Link key={t.key} href={t.href} className={`erp-detail-tab${activeTab === t.key ? " active" : ""}`}>
          {t.label}
        </Link>
      ))}
    </div>
  );

  if (activeTab === "matrix") {
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
        {header("결재매트릭스")}
        {tabs}

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

  const presets = await fetchAllRows<{
    id: string;
    name: string;
    approver_ids: string[];
    reference_ids: string[];
    profiles: { full_name: string | null } | null;
  }>((from, to) =>
    supabase
      .from("approval_line_presets")
      .select("id, name, approver_ids, reference_ids, profiles!created_by(full_name)")
      .order("name")
      .range(from, to),
  );

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ F2: { href: "/approvals/lines/new" }, Escape: { href: "/approvals" } }} />
      {header("공유 결재선")}
      {tabs}

      <PageGuide>
        자주 쓰는 결재선(결재자·참조자 순서 조합)을 이름 붙여 저장해두면,
        새 기안을 쓸 때 조직도를 다시 펼치지 않고 바로 불러와 쓸 수
        있습니다. 결재매트릭스 탭에서 결재양식과 연결해두면 그 양식을 고를
        때 자동으로 제안됩니다.
      </PageGuide>

      {presets.length === 0 ? (
        <p className="erp-grid-empty">등록된 결재선이 없습니다.</p>
      ) : (
        <div className="erp-grid-wrap">
          <table className="erp-grid">
            <thead>
              <tr>
                <th>이름</th>
                <th style={{ width: 90 }}>결재자</th>
                <th style={{ width: 90 }}>참조자</th>
                <th style={{ width: 110 }}>만든이</th>
                <th style={{ width: 140 }} />
              </tr>
            </thead>
            <tbody>
              {presets.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td className="num">{p.approver_ids.length}명</td>
                  <td className="num">{p.reference_ids.length}명</td>
                  <td>{p.profiles?.full_name ?? "-"}</td>
                  <td>
                    <div className="flex items-center gap-1">
                      <Link
                        href={`/approvals/lines/${p.id}/edit`}
                        className="erp-btn"
                        style={{ minWidth: 0, height: 24, padding: "0 8px", fontSize: 11 }}
                      >
                        수정
                      </Link>
                      <InlineConfirmDelete
                        action={deleteApprovalLinePreset}
                        hiddenFields={{ id: p.id }}
                        warningText="이 결재선을 삭제하시겠습니까? 결재매트릭스에 연결돼 있다면 그 규칙도 함께 삭제됩니다."
                        triggerStyle={{ minWidth: 0, height: 24, padding: "0 8px", fontSize: 11 }}
                      />
                    </div>
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
