import Link from "next/link";
import { createClient, getUser } from "@/lib/supabase/server";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { ListPageHeader, FormSection } from "@/components/erp/page-header";
import { PageGuide } from "@/components/erp/page-guide";
import { GridBadge } from "@/components/grid/badge";
import { InlineConfirmDelete } from "@/components/inline-confirm-delete";
import { ApprovalDetailPanel } from "@/components/approval-detail-panel";
import { ApprovalDocumentForm } from "@/components/approval-document-form";
import {
  deleteApprovalDraft,
  submitApprovalDocument,
  saveApprovalDraft,
} from "@/app/(dashboard)/approvals/actions";
import { requireFeatureEnabled } from "@/lib/require-feature-enabled";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { buildOrgTree } from "@/lib/org-chart";
import { isUuid } from "@/lib/is-uuid";
import { formatNumber } from "@/lib/format-number";

const STATUS_LABEL: Record<string, { label: string; tone: "ok" | "warn" | "danger" | "muted" }> = {
  pending: { label: "결재중", tone: "warn" },
  approved: { label: "승인완료", tone: "ok" },
  rejected: { label: "반려", tone: "danger" },
  recalled: { label: "회수됨", tone: "muted" },
};

// "임시저장"은 결재선도 없는 상신 전 문서라 다른 탭과 조회 조건이
// 완전히 다르다(created_by=본인만, approval_steps 계산 자체가 불필요) —
// 그래서 목록+상세 분할에도 안 태우고 지금처럼 전체 폭 표로 따로 둔다.
const TABS: { key: string; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "pending", label: "진행중" },
  { key: "approved", label: "완료" },
  { key: "rejected", label: "반려" },
  { key: "recalled", label: "회수" },
  { key: "draft", label: "임시저장" },
];

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; id?: string }>;
}) {
  const { status: statusParam, id } = await searchParams;
  const activeTab = TABS.some((t) => t.key === statusParam) ? statusParam! : "all";
  const selectedId = id && isUuid(id) ? id : undefined;

  const supabase = await createClient();
  await requireFeatureEnabled(supabase, "approvals");
  const user = await getUser();

  const tabHref = (key: string) => (key === "all" ? "/approvals" : `/approvals?status=${key}`);
  const newHref = tabHref(activeTab);

  const header = (
    <>
      <KeyboardShortcuts
        shortcuts={{ F2: { href: newHref }, Escape: { href: selectedId ? newHref : "/dashboard" } }}
      />
      <div className="erp-page-toolbar">
        <ListPageHeader
          title="전자결재 > 기안함"
          actions={
            <>
              <Link href={newHref} className="erp-btn erp-btn-primary">
                F2 기안
              </Link>
              <Link href="/approvals/lines" className="erp-btn">
                결재선 설정
              </Link>
              <Link href="/settings/delegations" className="erp-btn">
                전결권 관리
              </Link>
              {selectedId && (
                <Link href={newHref} className="erp-btn">
                  목록
                </Link>
              )}
            </>
          }
        />
      </div>

      <div className="erp-date-presets" style={{ marginBottom: 12 }}>
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={tabHref(t.key)}
            className={`erp-date-preset-btn${activeTab === t.key ? " active" : ""}`}
          >
            {t.label}
          </Link>
        ))}
      </div>
    </>
  );

  if (activeTab === "draft") {
    // RLS(approval_documents_select)가 created_by=본인 조건을 이미 걸어주지만,
    // 임시저장은 오직 본인만 봐야 하는 화면이라 쿼리에도 명시적으로 조건을
    // 반복해서 걸어둔다.
    const { data: drafts } = user
      ? await supabase
          .from("approval_documents")
          .select("id, title, created_at")
          .eq("status", "draft")
          .eq("created_by", user.id)
          .order("created_at", { ascending: false })
          .limit(200)
      : { data: [] };

    return (
      <div>
        {header}
        <PageGuide>
          결재선을 아직 확정하지 않고 저장해둔 문서입니다. 이어 쓰거나
          제출하기 전까지는 결재자에게 보이지 않습니다.
        </PageGuide>

        {!drafts || drafts.length === 0 ? (
          <p className="erp-grid-empty">임시저장된 문서가 없습니다.</p>
        ) : (
          <div className="erp-grid-wrap">
            <table className="erp-grid">
              <thead>
                <tr>
                  <th style={{ width: 130 }}>마지막 저장</th>
                  <th>제목</th>
                  <th style={{ width: 190 }} />
                </tr>
              </thead>
              <tbody>
                {drafts.map((d) => (
                  <tr key={d.id}>
                    <td>{new Date(d.created_at).toLocaleString("ko-KR")}</td>
                    <td>{d.title || "(제목 없음)"}</td>
                    <td>
                      <div className="flex items-center gap-1">
                        <Link
                          href={`/approvals/new?draft=${d.id}`}
                          className="erp-btn erp-btn-primary"
                          style={{ minWidth: 0, height: 24, padding: "0 8px", fontSize: 11 }}
                        >
                          이어 쓰기
                        </Link>
                        <InlineConfirmDelete
                          action={deleteApprovalDraft}
                          hiddenFields={{ id: d.id }}
                          warningText="이 임시저장 문서를 삭제하시겠습니까?"
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

  // RLS(approval_documents_select)가 이미 "본인 기안 또는 본인이 결재선에
  // 있는 문서"로만 걸러주지만, 그와 별개로 한 화면에서 무한정 쌓이지
  // 않게 최근 200건으로 명시적으로도 상한을 둔다.
  let query = supabase
    .from("approval_documents")
    .select("id, title, status, created_at, profiles!created_by(full_name)")
    .order("created_at", { ascending: false })
    .limit(200);
  // 임시저장(draft)은 위에서 이미 분기 처리했으니, 여기 "전체" 탭에는
  // 섞이지 않게 뺀다 — 안 그러면 "결재선도 없는 문서"가 목록에 나타나
  // 혼란스럽다.
  query = activeTab === "all" ? query.neq("status", "draft") : query.eq("status", activeTab);
  const { data: docs } = await query;

  // 지금 로그인한 사람이 대리 결재 중인 원 결재자 목록 — "내 차례" 판정에
  // 본인 몫뿐 아니라 위임받은 몫도 포함시킨다.
  const { data: delegations } = user
    ? await supabase
        .from("approval_delegations")
        .select("delegator_id, start_date, end_date")
        .eq("delegate_id", user.id)
    : { data: [] as { delegator_id: string; start_date: string; end_date: string }[] };
  const today = new Date().toISOString().slice(0, 10);
  const delegatedForIds = new Set(
    (delegations ?? []).filter((d) => d.start_date <= today && today <= d.end_date).map((d) => d.delegator_id),
  );

  const docIds = (docs ?? []).map((d) => d.id);
  const { data: steps } = docIds.length
    ? await supabase
        .from("approval_steps")
        .select("document_id, step_order, approver_id, status, role")
        .eq("role", "approver")
        .in("document_id", docIds)
        .order("step_order", { ascending: true })
    : { data: [] as { document_id: string; step_order: number; approver_id: string; status: string; role: string }[] };

  // 문서별 "지금 결재할 차례인 사람"을 구한다 — 순서대로 처리되므로
  // 아직 pending인 첫 단계가 곧 현재 차례다(참조자는 순서에 안 끼므로
  // role='approver'만 본다).
  const currentStepByDoc = new Map<string, { approverId: string; stepOrder: number }>();
  for (const s of steps ?? []) {
    if (s.status !== "pending" || s.step_order == null) continue;
    const existing = currentStepByDoc.get(s.document_id);
    if (!existing || s.step_order < existing.stepOrder) {
      currentStepByDoc.set(s.document_id, { approverId: s.approver_id, stepOrder: s.step_order });
    }
  }

  const rows = (docs ?? []).map((d) => {
    const current = currentStepByDoc.get(d.id);
    const myTurn =
      d.status === "pending" &&
      !!current &&
      (current.approverId === user?.id || delegatedForIds.has(current.approverId));
    return { ...d, myTurn };
  });

  const listParams = new URLSearchParams();
  if (activeTab !== "all") listParams.set("status", activeTab);
  const rowHref = (docId: string) => {
    const p = new URLSearchParams(listParams);
    p.set("id", docId);
    return `/approvals?${p.toString()}`;
  };

  // 기본(선택 없음) 상태에서 새 기안 폼을 그대로 띄우기 위한 데이터 —
  // approvals/new/page.tsx와 동일한 조회. draft 이어쓰기는 그 화면(별도
  // 페이지)에서 그대로 처리하고, 여기 기본 상태는 "새로 쓰기"만 다룬다.
  let formData: {
    orgTree: ReturnType<typeof buildOrgTree>;
    templates: { id: string; name: string; body: string }[];
    presets: { id: string; name: string; approverIds: string[]; referenceIds: string[] }[];
    matrixByTemplate: Record<string, string>;
    profileNameById: Record<string, string>;
  } | null = null;
  if (!selectedId) {
    const [departments, profiles, templates, presetsRaw, matrixRaw] = await Promise.all([
      fetchAllRows<{ id: string; name: string; parent_department_id: string | null; sort_order: number }>((from, to) =>
        supabase.from("departments").select("id, name, parent_department_id, sort_order").order("sort_order").range(from, to),
      ),
      fetchAllRows<{ id: string; full_name: string | null; position_title: string | null; department_id: string | null }>(
        (from, to) => supabase.from("profiles").select("id, full_name, position_title, department_id").order("full_name").range(from, to),
      ),
      fetchAllRows<{ id: string; name: string; body: string }>((from, to) =>
        supabase
          .from("document_templates")
          .select("id, name, body")
          .eq("category", "approval")
          .eq("is_active", true)
          .order("name")
          .range(from, to),
      ),
      fetchAllRows<{ id: string; name: string; approver_ids: string[]; reference_ids: string[] }>((from, to) =>
        supabase.from("approval_line_presets").select("id, name, approver_ids, reference_ids").order("name").range(from, to),
      ),
      fetchAllRows<{ template_id: string; preset_id: string }>((from, to) =>
        supabase.from("approval_matrix_rules").select("template_id, preset_id").range(from, to),
      ),
    ]);
    const orgTree = buildOrgTree(
      departments.map((d) => ({ id: d.id, name: d.name, parentDepartmentId: d.parent_department_id, sortOrder: d.sort_order })),
      profiles.map((p) => ({ id: p.id, fullName: p.full_name, positionTitle: p.position_title, departmentId: p.department_id })),
    );
    const profileNameById: Record<string, string> = {};
    for (const p of profiles) profileNameById[p.id] = p.full_name || "구성원";
    const presets = presetsRaw.map((p) => ({ id: p.id, name: p.name, approverIds: p.approver_ids, referenceIds: p.reference_ids }));
    const matrixByTemplate: Record<string, string> = {};
    for (const m of matrixRaw) matrixByTemplate[m.template_id] = m.preset_id;
    formData = { orgTree, templates, presets, matrixByTemplate, profileNameById };
  }

  return (
    <div>
      {header}

      <PageGuide>
        본인이 기안했거나 결재선/참조에 포함된 문서만 보입니다. &quot;내 차례&quot;
        배지가 붙은 문서는 지금 승인/반려를 기다리고 있고(대리 결재 중인
        문서도 포함), 아직 상신 전인 문서는 임시저장 탭에서 이어 씁니다.
      </PageGuide>

      <div className="erp-split-shell" data-mobile-view={selectedId ? "detail" : "list"}>
        <section className="erp-split-list">
          <div className="erp-split-list-head">
            <span>기안 목록</span>
            <span style={{ color: "var(--erp-text-muted)", fontWeight: 400 }}>
              총 {formatNumber(rows.length)}건
            </span>
          </div>
          <div className="erp-split-list-body">
            {rows.map((d) => {
              const status = STATUS_LABEL[d.status] ?? { label: d.status, tone: "muted" as const };
              return (
                <Link
                  key={d.id}
                  href={rowHref(d.id)}
                  className={`erp-split-list-row${d.id === selectedId ? " active" : ""}`}
                >
                  {d.title}
                  {d.myTurn && (
                    <span style={{ marginLeft: 6 }}>
                      <GridBadge tone="warn">내 차례</GridBadge>
                    </span>
                  )}
                  <div className="erp-split-list-row-sub">
                    {d.profiles?.full_name ?? "-"} · {new Date(d.created_at).toLocaleDateString("ko-KR")} ·{" "}
                    {status.label}
                  </div>
                </Link>
              );
            })}
            {rows.length === 0 && (
              <p className="p-3 text-xs" style={{ color: "var(--erp-text-muted)" }}>
                해당하는 문서가 없습니다.
              </p>
            )}
          </div>
        </section>

        <div className="erp-split-detail">
          {selectedId ? (
            <ApprovalDetailPanel id={selectedId} closeHref={newHref} />
          ) : (
            formData && (
              <FormSection tabLabel="기안서 작성">
                <ApprovalDocumentForm
                  action={submitApprovalDocument}
                  draftAction={saveApprovalDraft}
                  orgTree={formData.orgTree}
                  templates={formData.templates}
                  presets={formData.presets}
                  matrixByTemplate={formData.matrixByTemplate}
                  profileNameById={formData.profileNameById}
                />
              </FormSection>
            )
          )}
        </div>
      </div>
    </div>
  );
}
