import { NewButton } from "@/components/erp/list-toolbar";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentActor } from "@/lib/current-actor";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { ListPageHeader, SplitDetailEmpty, SplitListFiller } from "@/components/erp/page-header";
import { GuardedLink } from "@/components/erp/guarded-link";
import { SplitFilterColumn } from "@/components/erp/split-filter-column";
import { PageGuide } from "@/components/erp/page-guide";
import { GroupIcon } from "@/components/erp/groupware-icons";
import { CloseButton } from "@/components/erp/close-button";
import { InlineConfirmDelete } from "@/components/inline-confirm-delete";
import { ApprovalMatrixRuleSelect } from "@/components/approval-matrix-rule-select";
import { deleteApprovalLinePreset } from "@/app/(dashboard)/approvals/lines/actions";
import { setApprovalMatrixRule } from "@/app/(dashboard)/approvals/matrix/actions";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { requireFeatureEnabled } from "@/lib/require-feature-enabled";
import { isUuid } from "@/lib/is-uuid";

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

// 모던 테마(grid-modern) 전용 B형 결재선 설정 — 필터 열(구분·만든이) | 목록 | 상세, 새 결재선·수정은 C형 모달. 클래식은 classic.tsx(동결본).
export default async function ApprovalLinesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; id?: string; owner?: string }>;
}) {
  const { tab, id, owner: ownerParam } = await searchParams;
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
            <NewButton href="/approvals/lines/new">새 결재선</NewButton>
          )}
          <CloseButton href="/approvals">ESC 기안함으로</CloseButton>
        </>
      }
    />
  );

  const tabGroup = { heading: "구분", items: TABS.map((t) => ({ key: t.key, label: t.label, active: activeTab === t.key, href: t.href })) };

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

        <div className="erp-split3-shell" data-mobile-view="list">
        <SplitFilterColumn ariaLabel="결재선 필터" groups={[tabGroup]} />
        <section className="erp-split-list erp-split3-rest">
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
              <div className="erp-u-flex erp-u-items-center erp-u-justify-between erp-u-gap-s5 erp-u-bg-panel erp-u-flex-none erp-u-border-comm-border erp-u-radius-comm-row erp-u-shadow-comm-row"
                key={t.id}
                style={{ padding: "13px 18px" }}
              >
                <div className="erp-u-semibold erp-u-text erp-u-text-md">{t.name}</div>
                {isAdmin ? (
                  <ApprovalMatrixRuleSelect
                    templateId={t.id}
                    presetId={presetIdByTemplate[t.id] ?? ""}
                    presets={presets}
                    action={setApprovalMatrixRule}
                  />
                ) : (
                  <span className="erp-u-muted erp-u-text-base">
                    {presets.find((p) => p.id === presetIdByTemplate[t.id])?.name ?? "연결 안 함"}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
        </section>
        </div>
      </div>
    );
  }

  const [presets, profiles] = await Promise.all([
    fetchAllRows<{
      id: string;
      name: string;
      approver_ids: string[];
      reference_ids: string[];
      created_by: string | null;
      profiles: { full_name: string | null } | null;
    }>((from, to) =>
      supabase
        .from("approval_line_presets")
        .select("id, name, approver_ids, reference_ids, created_by, profiles!created_by(full_name)")
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
  ]);

  const nameById: Record<string, string> = {};
  for (const p of profiles) nameById[p.id] = p.full_name || "구성원";

  const selected = selectedId ? presets.find((p) => p.id === selectedId) : undefined;
  const listBase = "/approvals/lines";
  const owner = ownerParam && isUuid(ownerParam) ? ownerParam : "all";
  const ownerCounts = new Map<string, { name: string; count: number }>();
  for (const p of presets) {
    if (!p.created_by) continue;
    const o = ownerCounts.get(p.created_by) ?? { name: p.profiles?.full_name ?? "이름 없음", count: 0 };
    o.count += 1;
    ownerCounts.set(p.created_by, o);
  }
  const visible = owner === "all" ? presets : presets.filter((p) => p.created_by === owner);
  const withOwner = (extra?: Record<string, string>) => {
    const q = new URLSearchParams(extra);
    if (owner !== "all") q.set("owner", owner);
    return q.toString() ? `${listBase}?${q.toString()}` : listBase;
  };
  const listHref = withOwner();

  return (
    <div className="erp-comm-shell">
      <KeyboardShortcuts
        shortcuts={{
          F2: { href: "/approvals/lines/new" },
          Escape: { href: selectedId ? listHref : "/approvals" },
        }}
      />
      {header("공유 결재선")}

      <PageGuide>
        자주 쓰는 결재선(결재자·참조자 순서 조합)을 이름 붙여 저장해두면,
        새 기안을 쓸 때 조직도를 다시 펼치지 않고 바로 불러와 쓸 수
        있습니다. 결재매트릭스 탭에서 결재양식과 연결해두면 그 양식을 고를
        때 자동으로 제안됩니다.
      </PageGuide>

      <div className="erp-split3-shell" data-mobile-view={selectedId ? "detail" : "list"}>
        <SplitFilterColumn
          ariaLabel="결재선 필터"
          groups={[
            tabGroup,
            {
              heading: "만든이",
              items: [{ key: "all", label: "전체", count: presets.length }, ...[...ownerCounts.entries()].sort((a, b) => b[1].count - a[1].count).map(([oid, o]) => ({ key: oid, label: o.name, count: o.count }))].map((it) => ({
                ...it,
                active: owner === it.key,
                href: it.key === "all" ? listBase : `${listBase}?owner=${it.key}`,
              })),
            },
          ]}
        />
        <section className="erp-split-list">
          <div className="erp-split-list-head">
            <span>결재선 목록</span>
            <span className="erp-u-muted erp-u-normal">총 {visible.length}건</span>
          </div>
          <div className="erp-split-list-body">
            {visible.map((p) => (
              <Link
                key={p.id}
                href={withOwner({ id: p.id })}
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
              title={visible.length === 0 ? "등록된 결재선이 없습니다" : "새 결재선을 추가해보세요"}
              hint="자주 쓰는 결재자·참조자 조합을 이름 붙여 저장해두면 기안 쓸 때 바로 불러올 수 있습니다."
              actionHref="/approvals/lines/new"
              actionLabel="+ 새 결재선"
            />
          </div>
        </section>

        <div className="erp-split-detail">
          {selected ? (
            <>
              <h2 className="erp-u-mb-4 text-base erp-u-bold erp-u-text">
                {selected.name}
              </h2>
              <p className="erp-u-mb-20 erp-u-text-compact erp-u-muted">
                만든이 {selected.profiles?.full_name ?? "-"}
              </p>

              <div className="erp-u-mb-8 erp-u-text-compact erp-u-bold erp-u-muted">
                결재자 순서
              </div>
              <div className="erp-u-mb-20 erp-u-flex erp-u-wrap erp-u-items-center erp-u-gap-6">
                {selected.approver_ids.map((aid, i) => (
                  <span className="erp-u-items-center erp-u-inline-flex erp-u-gap-s2" key={aid}>
                    <span style={chipStyle}>
                      <span style={chipAvatarStyle("var(--erp-primary)")}>{(nameById[aid] ?? "구성원")[0]}</span>
                      <span className="erp-u-semibold erp-u-text-compact">{nameById[aid] ?? "구성원"}</span>
                    </span>
                    {i < selected.approver_ids.length - 1 && (
                      <span className="erp-u-muted erp-u-text-md">→</span>
                    )}
                  </span>
                ))}
              </div>

              <div className="erp-u-mb-8 erp-u-text-compact erp-u-bold erp-u-muted">
                참조자
              </div>
              <div className="erp-u-mb-20 erp-u-flex erp-u-wrap erp-u-items-center erp-u-gap-6">
                {selected.reference_ids.map((rid) => (
                  <span key={rid} style={chipStyle}>
                    <span style={chipAvatarStyle("#64748b")}>{(nameById[rid] ?? "구성원")[0]}</span>
                    <span className="erp-u-semibold erp-u-text-compact">{nameById[rid] ?? "구성원"}</span>
                  </span>
                ))}
                {selected.reference_ids.length === 0 && (
                  <span className="erp-u-text-compact erp-u-muted">
                    없음
                  </span>
                )}
              </div>

              <div className="erp-u-flex erp-u-gap-8">
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
            <SplitDetailEmpty icon={<GroupIcon />} title="결재선을 선택해주세요" hint="왼쪽 목록에서 결재선을 누르면 여기에 내용이 표시됩니다. 새 결재선은 [새 결재선]으로 추가합니다." />
          )}
        </div>
      </div>
    </div>
  );
}
