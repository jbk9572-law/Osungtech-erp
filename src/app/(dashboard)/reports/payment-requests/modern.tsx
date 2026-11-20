import { createClient } from "@/lib/supabase/server";
import { PageGuide } from "@/components/erp/page-guide";
import { QuickPaymentRequestForm } from "@/components/quick-payment-request-form";
import { GridBadge } from "@/components/grid/badge";
import { bulkDeletePaymentRequests } from "@/app/(dashboard)/reports/payment-requests/actions";
import { paymentRequestDocTitle } from "@/lib/payment-request-title";
import { todayKstStr } from "@/lib/kst-date";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { formatNumber } from "@/lib/format-number";
import { resolveStatusLabel } from "@/lib/status-label";
import { RecordPageA } from "@/components/grid/record-page-a";
import type { RecordRow } from "@/components/grid/record-list-a";

const STATUS_LABEL: Record<string, { label: string; tone: "ok" | "warn" | "danger" | "muted" }> = {
  draft: { label: "작성중", tone: "muted" },
  pending: { label: "결재중", tone: "warn" },
  approved: { label: "승인완료", tone: "ok" },
  rejected: { label: "반려", tone: "danger" },
};

function formatPeriod(from: string | null, to: string | null) {
  if (!from && !to) return "-";
  const fmt = (d: string) => d.replaceAll("-", ".");
  if (from && to && from === to) return fmt(from);
  return `${from ? fmt(from) : "?"} ~ ${to ? fmt(to) : "?"}`;
}

type PaymentRequestQueryRow = {
  id: string;
  title: string | null;
  department: string | null;
  period_from: string | null;
  period_to: string | null;
  card_type: string | null;
  created_at: string;
  status: string;
  profiles: { full_name: string | null } | null;
  payment_request_line_items: { amount: number }[] | null;
};

export default async function PaymentRequestsPage() {
  const supabase = await createClient();
  // .limit(200)으로 고정해두면 지급결의서가 200건을 넘는 순간 그 이전
  // 문서는 이 목록에서 영구히 안 보이고(검색도 안 됨), "no" 번호도 매번
  // 가져온 200건 안에서의 위치일 뿐이라 새 문서가 등록될 때마다
  // 같은 문서의 번호가 계속 바뀐다 — fetchAllRows로 전체를 가져와서
  // 번호가 실제 등록 순서를 그대로 반영하게 한다.
  const [rows, { data: company }] = await Promise.all([
    fetchAllRows<PaymentRequestQueryRow>((from, to) =>
      supabase
        .from("payment_requests")
        .select(
          "id, title, department, period_from, period_to, card_type, created_at, status, profiles!requested_by(full_name), payment_request_line_items(amount)"
        )
        .order("created_at", { ascending: false })
        .range(from, to)
    ),
    supabase.from("company_profile").select("name").maybeSingle(),
  ]);


  // 모던 테마(grid-modern) 전용 A형 화면 — 클래식은 classic.tsx(동결본).
  const labelById = new Map<string, string>();
  const recordRows: RecordRow[] = rows.map((row) => {
    const total = (row.payment_request_line_items ?? []).reduce((sum, item) => sum + Number(item.amount), 0);
    const status = resolveStatusLabel(STATUS_LABEL, row.status);
    const label = row.department || row.title || paymentRequestDocTitle(row.card_type);
    labelById.set(row.id, label);
    const period = formatPeriod(row.period_from, row.period_to);
    const badge = <GridBadge tone={status.tone}>{status.label}</GridBadge>;
    return {
      id: row.id,
      href: `/reports/payment-requests/${row.id}`,
      cells: [label, paymentRequestDocTitle(row.card_type), period, formatNumber(total), row.profiles?.full_name ?? "-", badge],
      card: {
        title: (
          <>
            <span className="erp-row-card-partner">{label}</span>
            {badge}
          </>
        ),
        sub: `${paymentRequestDocTitle(row.card_type)} · ${period}`,
        foot: <span className="erp-row-card-amount">{formatNumber(total)}원</span>,
      },
      panel: {
        title: label,
        subtitle: paymentRequestDocTitle(row.card_type),
        badge: { tone: status.tone === "danger" ? "danger" : status.tone === "warn" ? "warn" : "ok", label: status.label },
        kv: [
          { label: "기간", value: period },
          { label: "작성자", value: row.profiles?.full_name ?? "-" },
          { label: "등록일", value: row.created_at.slice(0, 10).replaceAll("-", ".") },
        ],
        totals: [
          { label: "항목", value: `${formatNumber((row.payment_request_line_items ?? []).length)}건` },
          { label: "지급 합계", value: formatNumber(total), strong: true },
        ],
        actions: [
          { label: "수정·상세", href: `/reports/payment-requests/${row.id}` },
          { label: "인쇄", href: `/reports/payment-requests/${row.id}/print` },
        ],
      },
    };
  });
  return (
    <RecordPageA
      title="보고서 &gt; 지급결의양식"
      basePath="/reports/payment-requests"
      newLabel="글쓰기"
      filters={
        <div className="erp-detail erp-u-mt-0 erp-u-mb-12">
          <div className="erp-detail-tabs">
            <span className="erp-detail-tab active">오늘 지출 빠르게 기록</span>
          </div>
          <div className="erp-detail-body">
            <PageGuide>
              문서를 따로 만들지 않아도 됩니다 — 같은 부서·카드로 이번 달에 이미 쓴 문서가 있으면 거기에 이어서 추가되고, 없으면 자동으로 새로 만들어집니다.
            </PageGuide>
            <QuickPaymentRequestForm defaultDepartment={company?.name ?? ""} today={todayKstStr()} />
          </div>
        </div>
      }
      columns={[{ label: "부서·제목" }, { label: "양식" }, { label: "기간" }, { label: "지급 합계", num: true }, { label: "작성자" }, { label: "상태" }]}
      rows={recordRows}
      panelAriaLabel="선택한 지급결의서 상세"
      hasMore={false}
      moreHref=""
      moreStep={0}
      emptyMessage="등록된 지급결의서가 없습니다."
      bulkDelete={{
        action: bulkDeletePaymentRequests,
        warningText: "지급결의서 삭제는 되돌릴 수 없습니다. 첨부된 영수증 파일도 함께 삭제됩니다.",
        labelOf: (rid) => labelById.get(rid) ?? rid,
      }}
    />
  );

}
