import Link from "next/link";
import { createClient, getUser } from "@/lib/supabase/server";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { PageGuide } from "@/components/erp/page-guide";
import { GridBadge } from "@/components/grid/badge";
import { ClickableRow } from "@/components/clickable-row";

const STATUS_LABEL: Record<string, { label: string; tone: "ok" | "warn" | "danger" }> = {
  pending: { label: "결재중", tone: "warn" },
  approved: { label: "승인완료", tone: "ok" },
  rejected: { label: "반려", tone: "danger" },
};

const TABS: { key: string; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "pending", label: "진행중" },
  { key: "approved", label: "완료" },
  { key: "rejected", label: "반려" },
];

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: statusParam } = await searchParams;
  const activeTab = TABS.some((t) => t.key === statusParam) ? statusParam! : "all";

  const supabase = await createClient();
  const user = await getUser();

  // RLS(approval_documents_select)가 이미 "본인 기안 또는 본인이 결재선에
  // 있는 문서"로만 걸러주지만, 그와 별개로 한 화면에서 무한정 쌓이지
  // 않게 최근 200건으로 명시적으로도 상한을 둔다.
  let query = supabase
    .from("approval_documents")
    .select("id, title, status, created_at, profiles!created_by(full_name)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (activeTab !== "all") query = query.eq("status", activeTab);
  const { data: docs } = await query;

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
    // role="approver"로 이미 걸러서 조회했으니 실제로는 항상 값이
    // 있지만, 타입 상으로는 nullable(참조자용)이라 방어적으로 건너뛴다.
    if (s.status !== "pending" || s.step_order == null) continue;
    const existing = currentStepByDoc.get(s.document_id);
    if (!existing || s.step_order < existing.stepOrder) {
      currentStepByDoc.set(s.document_id, { approverId: s.approver_id, stepOrder: s.step_order });
    }
  }

  const rows = (docs ?? []).map((d) => {
    const current = currentStepByDoc.get(d.id);
    const myTurn = d.status === "pending" && current?.approverId === user?.id;
    return { ...d, myTurn };
  });

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ F2: { href: "/approvals/new" }, Escape: { href: "/dashboard" } }} />
      <h1 className="mb-3 text-lg font-bold text-[var(--erp-text)]">전자결재 &gt; 기안함</h1>

      <div className="erp-toolbar">
        <Link href="/approvals/new" className="erp-btn erp-btn-primary">
          F2 기안
        </Link>
        <Link href="/dashboard" className="erp-btn erp-btn-dark">
          ESC 닫기
        </Link>
      </div>

      <PageGuide>
        본인이 기안했거나 결재선/참조에 포함된 문서만 보입니다. &quot;내 차례&quot;
        배지가 붙은 문서는 지금 승인/반려를 기다리고 있습니다.
      </PageGuide>

      <div className="erp-date-presets" style={{ marginBottom: 12 }}>
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "all" ? "/approvals" : `/approvals?status=${t.key}`}
            className={`erp-date-preset-btn${activeTab === t.key ? " active" : ""}`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--erp-text-muted)" }}>
          해당하는 문서가 없습니다.
        </p>
      ) : (
        <div className="erp-grid-wrap">
          <table className="erp-grid">
            <thead>
              <tr>
                <th style={{ width: 130 }}>일시</th>
                <th>제목</th>
                <th style={{ width: 110 }}>기안자</th>
                <th style={{ width: 90 }}>상태</th>
                <th style={{ width: 90 }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => {
                const status = STATUS_LABEL[d.status] ?? { label: d.status, tone: "muted" as const };
                return (
                  <ClickableRow key={d.id} href={`/approvals/${d.id}`}>
                    <td>{new Date(d.created_at).toLocaleString("ko-KR")}</td>
                    <td>{d.title}</td>
                    <td>{d.profiles?.full_name ?? "-"}</td>
                    <td>
                      <GridBadge tone={status.tone}>{status.label}</GridBadge>
                    </td>
                    <td>
                      {d.myTurn && <GridBadge tone="warn">내 차례</GridBadge>}
                    </td>
                  </ClickableRow>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
