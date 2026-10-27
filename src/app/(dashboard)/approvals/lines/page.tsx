import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentActor } from "@/lib/current-actor";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { ListPageHeader, FormSection, SplitListFiller } from "@/components/erp/page-header";
import { PageGuide } from "@/components/erp/page-guide";
import { GroupIcon } from "@/components/erp/groupware-icons";
import { CloseButton } from "@/components/erp/close-button";
import { InlineConfirmDelete } from "@/components/inline-confirm-delete";
import { ApprovalMatrixRuleSelect } from "@/components/approval-matrix-rule-select";
import { ApprovalLinePresetForm } from "@/components/approval-line-preset-form";
import { createApprovalLinePreset, deleteApprovalLinePreset } from "@/app/(dashboard)/approvals/lines/actions";
import { setApprovalMatrixRule } from "@/app/(dashboard)/approvals/matrix/actions";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { requireFeatureEnabled } from "@/lib/require-feature-enabled";
import { isUuid } from "@/lib/is-uuid";
import { buildOrgTree } from "@/lib/org-chart";

// 공유 결재선(누가 결재하는지)과 결재매트릭스(어느 양식이 어느 결재선을
// 자동으로 쓰는지)가 전에는 별도 화면이었는데, 둘 다 소규모 설정
// 화면이고 항상 붙어 다니는 개념이라(매트릭스가 결재선 목록을 그대로
// 참조) 탭 하나로 합쳤다(감사에서 지적됨 — 화면 통폐합). 표 기반
// 관리화면이었던 걸, 다른 그룹웨어 화면(메일함/게시판)과 같은
// "커뮤니케이션 서피스" 목록+상세 분할뷰·카드 리스트로 다시 디자인했다
// (/design 탐색 후 사용자 승인 — 레이아웃은 유지한 채 디자인만 통일).
const TABS = [
  { key: "lines", label: "공유 결재선", href: "/approvals/lines" },
  { key: "matrix", label: "결재매트릭스", href: "/approvals/lines?tab=matrix" },
] as const;

const chipAvatarStyle = (bg: string) =>
  ({
    width: 22,
    height: 22,
    borderRadius: 999,
    background: bg,
    color: "var(--erp-on-primary)",
    fontSize: 10,
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flex: "0 0 auto",
  }) as const;

const chipStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: "var(--erp-space-2)",
  padding: "6px 12px 6px 6px",
  borderRadius: 999,
  background: "var(--erp-bg)",
  border: "1px solid var(--erp-comm-border)",
} as const;

export default async function ApprovalLinesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; id?: string }>;
}) {
  const { tab, id } = await searchParams;
  const activeTab = tab === "matrix" ? "matrix" : "lines";
  const selectedId = id && isUuid(id) ? id : undefined;

  const supabase = await createClient();
  await requireFeatureEnabled(supabase, "approvals");

  const header = (title: string) => (
    <ListPageHeader
      title={`전자결재 > ${title}`}
      actions={
        <>
          {activeTab === "lines" && (
            <Link href="/approvals/lines" className="erp-btn erp-btn-primary">
              F2 새 결재선
            </Link>
          )}
          <CloseButton href="/approvals">ESC 기안함으로</CloseButton>
        </>
      }
    />
  );

  const tabs = (
    <div className="erp-comm-tabs" style={{ marginBottom: "var(--erp-space-4)" }}>
      {TABS.map((t) => (
        <Link key={t.key} href={t.href} className={`erp-comm-tab${activeTab === t.key ? " active" : ""}`}>
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
      <div className="erp-comm-shell">
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
          <div className="erp-card-feed erp-card-feed-compact">
            {templates.map((t) => (
              <div
                key={t.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "var(--erp-space-5)",
                  background: "var(--erp-panel)",
                  border: "1px solid var(--erp-comm-border)",
                  borderRadius: "var(--erp-comm-radius-row)",
                  boxShadow: "var(--erp-comm-shadow-row)",
                  padding: "13px 18px",
                  flex: "0 0 auto",
                }}
              >
                <div style={{ fontSize: "var(--erp-font-md)", fontWeight: 600, color: "var(--erp-text)" }}>{t.name}</div>
                {isAdmin ? (
                  <ApprovalMatrixRuleSelect
                    templateId={t.id}
                    presetId={presetIdByTemplate[t.id] ?? ""}
                    presets={presets}
                    action={setApprovalMatrixRule}
                  />
                ) : (
                  <span style={{ fontSize: "var(--erp-font-base)", color: "var(--erp-text-muted)" }}>
                    {presets.find((p) => p.id === presetIdByTemplate[t.id])?.name ?? "연결 안 함"}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const [presets, profiles, departments] = await Promise.all([
    fetchAllRows<{
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
    ),
    // full_name만으로 충분했던 전엔 이 한 줄이었는데, "새 결재선" 작성이
    // 상세패널 안으로 들어오면서(아래 참고) 조직도 선택기(buildOrgTree)에
    // 필요한 position_title/department_id도 같이 담아 같은 조회를
    // 재사용한다 — 별도 쿼리를 또 만들지 않는다.
    fetchAllRows<{ id: string; full_name: string | null; position_title: string | null; department_id: string | null }>(
      (from, to) => supabase.from("profiles").select("id, full_name, position_title, department_id").range(from, to),
    ),
    fetchAllRows<{ id: string; name: string; parent_department_id: string | null; sort_order: number }>((from, to) =>
      supabase.from("departments").select("id, name, parent_department_id, sort_order").order("sort_order").range(from, to),
    ),
  ]);

  const nameById: Record<string, string> = {};
  for (const p of profiles) nameById[p.id] = p.full_name || "구성원";

  const orgTree = buildOrgTree(
    departments.map((d) => ({ id: d.id, name: d.name, parentDepartmentId: d.parent_department_id, sortOrder: d.sort_order })),
    profiles.map((p) => ({ id: p.id, fullName: p.full_name, positionTitle: p.position_title, departmentId: p.department_id })),
  );

  const selected = selectedId ? presets.find((p) => p.id === selectedId) : undefined;
  const listHref = "/approvals/lines";

  return (
    <div className="erp-comm-shell">
      <KeyboardShortcuts
        shortcuts={{
          F2: { href: listHref },
          Escape: { href: selectedId ? listHref : "/approvals" },
        }}
      />
      {header("공유 결재선")}
      {tabs}

      <PageGuide>
        자주 쓰는 결재선(결재자·참조자 순서 조합)을 이름 붙여 저장해두면,
        새 기안을 쓸 때 조직도를 다시 펼치지 않고 바로 불러와 쓸 수
        있습니다. 결재매트릭스 탭에서 결재양식과 연결해두면 그 양식을 고를
        때 자동으로 제안됩니다.
      </PageGuide>

      <div className="erp-split-shell" data-mobile-view={selectedId ? "detail" : "list"}>
        <section className="erp-split-list">
          <div className="erp-split-list-head">
            <span>결재선 목록</span>
            <span style={{ color: "var(--erp-text-muted)", fontWeight: 400 }}>총 {presets.length}건</span>
          </div>
          <div className="erp-split-list-body">
            {presets.map((p) => (
              <Link
                key={p.id}
                href={`${listHref}?id=${p.id}`}
                className={`erp-split-list-row${p.id === selectedId ? " active" : ""}`}
              >
                <span style={{ fontWeight: p.id === selectedId ? 700 : 500 }}>{p.name}</span>
                <div className="erp-split-list-row-sub">
                  결재자 {p.approver_ids.length}명 · 참조자 {p.reference_ids.length}명
                </div>
              </Link>
            ))}
            <SplitListFiller
              icon={<GroupIcon />}
              title={presets.length === 0 ? "등록된 결재선이 없습니다" : "새 결재선을 추가해보세요"}
              hint="자주 쓰는 결재자·참조자 조합을 이름 붙여 저장해두면 기안 쓸 때 바로 불러올 수 있습니다."
              actionHref={listHref}
              actionLabel="+ 새 결재선"
            />
          </div>
        </section>

        <div className="erp-split-detail">
          {selected ? (
            <>
              <h2 className="mb-1 text-base font-bold" style={{ color: "var(--erp-text)" }}>
                {selected.name}
              </h2>
              <p className="mb-5 text-xs" style={{ color: "var(--erp-text-muted)" }}>
                만든이 {selected.profiles?.full_name ?? "-"}
              </p>

              <div className="mb-2 text-xs font-bold" style={{ color: "var(--erp-text-muted)" }}>
                결재자 순서
              </div>
              <div className="mb-5 flex flex-wrap items-center gap-1.5">
                {selected.approver_ids.map((aid, i) => (
                  <span key={aid} style={{ display: "inline-flex", alignItems: "center", gap: "var(--erp-space-2)" }}>
                    <span style={chipStyle}>
                      <span style={chipAvatarStyle("var(--erp-primary)")}>{(nameById[aid] ?? "구성원")[0]}</span>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>{nameById[aid] ?? "구성원"}</span>
                    </span>
                    {i < selected.approver_ids.length - 1 && (
                      <span style={{ color: "var(--erp-text-muted)", fontSize: "var(--erp-font-md)" }}>→</span>
                    )}
                  </span>
                ))}
              </div>

              <div className="mb-2 text-xs font-bold" style={{ color: "var(--erp-text-muted)" }}>
                참조자
              </div>
              <div className="mb-5 flex flex-wrap items-center gap-1.5">
                {selected.reference_ids.map((rid) => (
                  <span key={rid} style={chipStyle}>
                    <span style={chipAvatarStyle("#64748b")}>{(nameById[rid] ?? "구성원")[0]}</span>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{nameById[rid] ?? "구성원"}</span>
                  </span>
                ))}
                {selected.reference_ids.length === 0 && (
                  <span className="text-xs" style={{ color: "var(--erp-text-muted)" }}>
                    없음
                  </span>
                )}
              </div>

              <div className="flex gap-2">
                <Link href={`/approvals/lines/${selected.id}/edit`} className="erp-btn">
                  수정
                </Link>
                <InlineConfirmDelete
                  action={deleteApprovalLinePreset}
                  hiddenFields={{ id: selected.id }}
                  warningText="이 결재선을 삭제하시겠습니까? 결재매트릭스에 연결돼 있다면 그 규칙도 함께 삭제됩니다."
                />
              </div>
            </>
          ) : (
            // 문서양식관리/공지사항과 같은 방식 — 결재선 작성은 역할
            // 제한이 없어(createApprovalLinePreset 참고) 아무것도 선택
            // 안 한 기본 상태에 바로 작성 폼을 보여준다. "새 결재선"이
            // 분할뷰 밖 별도 화면으로 떠서 디자인 언어가 깨진다는 지적
            // ("왜 새창으로 넘어가는지 이해를못하겠어 이렇게 통일이
            // 안되냐고")을 반영 — 메일쓰기와 똑같이 우측 상세 패널
            // 자리에서 바로 작성한다.
            <div className="erp-split-detail-center">
              <FormSection tabLabel="결재선 등록">
                <ApprovalLinePresetForm action={createApprovalLinePreset} orgTree={orgTree} submitLabel="추가" />
              </FormSection>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
