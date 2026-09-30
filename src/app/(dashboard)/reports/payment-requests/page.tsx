import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { PageGuide } from "@/components/erp/page-guide";
import { QuickPaymentRequestForm } from "@/components/quick-payment-request-form";
import { PaymentRequestForm } from "@/components/payment-request-form";
import { PaymentRequestDetailPanel } from "@/components/payment-request-detail-panel";
import { SplitListBulkSelect, type SplitListBulkRow } from "@/components/erp/split-list-bulk-select";
import { GridBadge } from "@/components/grid/badge";
import { bulkDeletePaymentRequests } from "@/app/(dashboard)/reports/payment-requests/actions";
import { paymentRequestDocTitle } from "@/lib/payment-request-title";
import { todayKstStr } from "@/lib/kst-date";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { isUuid } from "@/lib/is-uuid";
import { formatNumber } from "@/lib/format-number";

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

export default async function PaymentRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  const selectedId = id && isUuid(id) ? id : undefined;
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

  const newHref = "/reports/payment-requests";
  const rowHref = (rowId: string) => `/reports/payment-requests?id=${rowId}`;

  return (
    <div>
      <KeyboardShortcuts
        shortcuts={{
          F2: { href: newHref },
          Escape: { href: selectedId ? newHref : "/dashboard" },
        }}
      />
      <div className="erp-page-toolbar erp-detail-header-row">
        <h1 className="text-lg font-bold text-[var(--erp-text)]">보고서 &gt; 지급결의양식</h1>
        <div className="erp-toolbar" style={{ marginBottom: 0 }}>
          <Link href={newHref} className="erp-btn erp-btn-primary">
            F2 글쓰기
          </Link>
          {selectedId && (
            <Link href={newHref} className="erp-btn">
              목록
            </Link>
          )}
        </div>
      </div>

      <div className="erp-detail" style={{ marginTop: 0, marginBottom: 12 }}>
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">오늘 지출 빠르게 기록</span>
        </div>
        <div className="erp-detail-body">
          <PageGuide>
            문서를 따로 만들지 않아도 됩니다 — 같은 부서·카드로 이번 달에 이미 쓴 문서가 있으면 거기에 이어서
            추가되고, 없으면 자동으로 새로 만들어집니다.
          </PageGuide>
          <QuickPaymentRequestForm defaultDepartment={company?.name ?? ""} today={todayKstStr()} />
        </div>
      </div>

      <div className="erp-split-shell" data-mobile-view={selectedId ? "detail" : "list"}>
        <section className="erp-split-list">
          <div className="erp-split-list-head">
            <span>지급결의서 목록</span>
            <span style={{ color: "var(--erp-text-muted)", fontWeight: 400 }}>총 {formatNumber(rows.length)}건</span>
          </div>
          <div className="erp-split-list-body">
            <SplitListBulkSelect
              rows={rows.map((row): SplitListBulkRow => {
                const total = (row.payment_request_line_items ?? []).reduce((sum, item) => sum + Number(item.amount), 0);
                const status = STATUS_LABEL[row.status] ?? { label: row.status, tone: "muted" as const };
                const label = row.department || row.title || paymentRequestDocTitle(row.card_type);
                return {
                  id: row.id,
                  href: rowHref(row.id),
                  active: row.id === selectedId,
                  label,
                  content: (
                    <>
                      {label}
                      <span style={{ marginLeft: 6 }}>
                        <GridBadge tone={status.tone}>{status.label}</GridBadge>
                      </span>
                      <div className="erp-split-list-row-sub">
                        {paymentRequestDocTitle(row.card_type)} · {formatNumber(total)}원 · {formatPeriod(row.period_from, row.period_to)}
                      </div>
                    </>
                  ),
                };
              })}
              bulkDeleteAction={bulkDeletePaymentRequests}
              warningText="지급결의서 삭제는 되돌릴 수 없습니다. 첨부된 영수증 파일도 함께 삭제됩니다."
              emptyMessage="등록된 지급결의서가 없습니다."
            />
          </div>
        </section>

        <div className="erp-split-detail">
          {selectedId ? (
            <PaymentRequestDetailPanel id={selectedId} closeHref={newHref} />
          ) : (
            <PaymentRequestForm defaultDepartment={company?.name ?? ""} today={todayKstStr()} />
          )}
        </div>
      </div>
    </div>
  );
}
