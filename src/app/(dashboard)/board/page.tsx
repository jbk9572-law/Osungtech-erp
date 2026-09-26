import { createClient, getUser } from "@/lib/supabase/server";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { ListPageHeader } from "@/components/erp/page-header";
import { PageGuide } from "@/components/erp/page-guide";
import { isFeatureEnabled } from "@/lib/require-feature-enabled";
import { BoardGridTable, type BoardRow } from "@/components/board-grid-table";

const PER_CATEGORY_LIMIT = 100;

const HR_DOC_STATUS = {
  issued: { label: "발급완료", tone: "ok" as const },
  draft: { label: "초안", tone: "warn" as const },
};

const OFFICIAL_STATUS: Record<string, { label: string; tone: "ok" | "warn" | "danger" | "muted" | "info" }> = {
  draft: { label: "작성중", tone: "muted" },
  pending_approval: { label: "결재중", tone: "warn" },
  approved: { label: "승인(발송대기)", tone: "info" },
  sent: { label: "발송완료", tone: "ok" },
  closed: { label: "종결", tone: "muted" },
  cancelled: { label: "취소", tone: "danger" },
};

const APPROVAL_STATUS: Record<string, { label: string; tone: "ok" | "warn" | "danger" | "muted" | "info" }> = {
  pending: { label: "결재중", tone: "warn" },
  approved: { label: "승인완료", tone: "ok" },
  rejected: { label: "반려", tone: "danger" },
  recalled: { label: "회수됨", tone: "muted" },
};

// 공지사항/인사관리>문서함/공문관리>내공문함·받은공문함/전자결재>기안함 —
// 전부 "확인해야 할 문서 목록"이라는 성격은 같은데 트리메뉴의 4개
// 다른 그룹에 흩어져 있어서 한눈에 훑어보려면 4번 들어가야 했다.
// 각 화면/테이블/RLS/워크플로우는 하나도 안 건드리고, 최근 항목만 모아
// 보여주는 진입점 하나를 새로 만든다 — 클릭하면 원래 상세 화면으로
// 그대로 이동한다.
export default async function BoardPage() {
  const supabase = await createClient();
  const user = await getUser();

  const [hrEnabled, officialEnabled, approvalsEnabled] = await Promise.all([
    isFeatureEnabled(supabase, "hr"),
    isFeatureEnabled(supabase, "official_documents"),
    isFeatureEnabled(supabase, "approvals"),
  ]);

  const rows: BoardRow[] = [];

  // ── 공지사항 (항상 켜져 있는 핵심 기능이라 featureKey 없음) ──────────
  const { data: notices } = await supabase
    .from("announcements")
    .select("id, title, pinned, created_at")
    .order("created_at", { ascending: false })
    .limit(PER_CATEGORY_LIMIT);
  const noticeIds = (notices ?? []).map((n) => n.id);
  const { data: readRows } =
    user && noticeIds.length
      ? await supabase.from("announcement_reads").select("announcement_id").eq("user_id", user.id).in("announcement_id", noticeIds)
      : { data: [] as { announcement_id: string }[] };
  const readIds = new Set((readRows ?? []).map((r) => r.announcement_id));
  for (const n of notices ?? []) {
    const unread = !readIds.has(n.id);
    rows.push({
      id: n.id,
      category: "notice",
      title: n.title,
      status: unread ? { label: "안읽음", tone: "danger" } : n.pinned ? { label: "고정", tone: "info" } : null,
      date: n.created_at,
      href: `/announcements/${n.id}`,
    });
  }

  // ── 인사관리 > 문서함 ────────────────────────────────────────────
  if (hrEnabled) {
    // document_instances_select RLS가 이미 "내가 만들었거나 나에 대한
    // 문서 또는 관리자"로 걸러준다(hr/documents/page.tsx와 동일).
    const { data: hrDocs } = await supabase
      .from("document_instances")
      .select("id, title, status, created_at")
      .order("created_at", { ascending: false })
      .limit(PER_CATEGORY_LIMIT);
    for (const d of hrDocs ?? []) {
      rows.push({
        id: d.id,
        category: "hr_doc",
        title: d.title,
        status: HR_DOC_STATUS[d.status as keyof typeof HR_DOC_STATUS] ?? { label: d.status, tone: "muted" },
        date: d.created_at,
        href: `/hr/documents/${d.id}`,
      });
    }
  }

  // ── 공문관리(내 공문함 + 받은 공문함 합침) ───────────────────────
  if (officialEnabled && user) {
    const [{ data: mineDocs }, { data: recipientRows }] = await Promise.all([
      supabase
        .from("official_documents")
        .select("id, title, status, created_at")
        .eq("created_by", user.id)
        .order("created_at", { ascending: false })
        .limit(PER_CATEGORY_LIMIT),
      supabase.from("official_document_recipients").select("official_document_id").eq("user_id", user.id).limit(PER_CATEGORY_LIMIT),
    ]);
    const receivedIds = Array.from(new Set((recipientRows ?? []).map((r) => r.official_document_id)));
    const { data: receivedDocs } = receivedIds.length
      ? await supabase
          .from("official_documents")
          .select("id, title, status, created_at")
          .in("id", receivedIds)
          .order("created_at", { ascending: false })
          .limit(PER_CATEGORY_LIMIT)
      : { data: [] as { id: string; title: string; status: string; created_at: string }[] };
    const officialById = new Map<string, { id: string; title: string; status: string; created_at: string }>();
    for (const d of [...(mineDocs ?? []), ...(receivedDocs ?? [])]) officialById.set(d.id, d);
    for (const d of officialById.values()) {
      rows.push({
        id: d.id,
        category: "official",
        title: d.title,
        status: OFFICIAL_STATUS[d.status] ?? { label: d.status, tone: "muted" },
        date: d.created_at,
        href: `/official-documents/${d.id}`,
      });
    }
  }

  // ── 전자결재 > 기안함(임시저장 제외 — approvals/page.tsx와 동일) ──
  if (approvalsEnabled) {
    const { data: approvalDocs } = await supabase
      .from("approval_documents")
      .select("id, title, status, created_at")
      .neq("status", "draft")
      .order("created_at", { ascending: false })
      .limit(PER_CATEGORY_LIMIT);
    for (const d of approvalDocs ?? []) {
      rows.push({
        id: d.id,
        category: "approval",
        title: d.title,
        status: APPROVAL_STATUS[d.status] ?? { label: d.status, tone: "muted" },
        date: d.created_at,
        href: `/approvals/${d.id}`,
      });
    }
  }

  rows.sort((a, b) => b.date.localeCompare(a.date));

  const counts = {
    all: rows.length,
    notice: rows.filter((r) => r.category === "notice").length,
    hr_doc: rows.filter((r) => r.category === "hr_doc").length,
    official: rows.filter((r) => r.category === "official").length,
    approval: rows.filter((r) => r.category === "approval").length,
  };

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/dashboard" } }} />
      <ListPageHeader title="게시판" />
      <PageGuide>
        공지사항 / 인사문서함 / 공문함 / 결재·기안함의 최근 항목을 한 화면에 모아 보여줍니다. 각 항목은 원래 화면으로
        그대로 연결되며, 여기서는 훑어보기용입니다 — 상세 필터·처리는 각 메뉴에서 그대로 이용하세요.
      </PageGuide>

      <BoardGridTable rows={rows} counts={counts} />
    </div>
  );
}
