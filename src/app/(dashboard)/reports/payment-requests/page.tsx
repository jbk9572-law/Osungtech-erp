import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { QuickPaymentRequestForm } from "@/components/quick-payment-request-form";
import { PaymentRequestGridTable, type PaymentRequestRow } from "@/components/payment-request-grid-table";
import { paymentRequestDocTitle } from "@/lib/payment-request-title";
import { todayKstStr } from "@/lib/kst-date";
import { fetchAllRows } from "@/lib/fetch-all-rows";

type PaymentRequestQueryRow = {
  id: string;
  title: string | null;
  department: string | null;
  period_from: string | null;
  period_to: string | null;
  card_type: string | null;
  created_at: string;
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
          "id, title, department, period_from, period_to, card_type, created_at, profiles(full_name), payment_request_line_items(amount)"
        )
        .order("created_at", { ascending: false })
        .range(from, to)
    ),
    supabase.from("company_profile").select("name").maybeSingle(),
  ]);

  const gridRows: PaymentRequestRow[] = rows.map((row, i) => ({
    id: row.id,
    no: rows.length - i,
    docTitle: paymentRequestDocTitle(row.card_type),
    department: row.department || row.title || "",
    periodFrom: row.period_from,
    periodTo: row.period_to,
    authorName: row.profiles?.full_name ?? null,
    total: (row.payment_request_line_items ?? []).reduce((sum, item) => sum + Number(item.amount), 0),
    createdAt: row.created_at,
  }));

  return (
    <div>
      <KeyboardShortcuts
        shortcuts={{
          F2: { href: "/reports/payment-requests/new" },
          Escape: { href: "/dashboard" },
        }}
      />
      <h1 className="mb-3 text-lg font-bold text-[var(--erp-text)]">보고서 &gt; 지급결의양식</h1>

      <div className="erp-detail" style={{ marginTop: 0, marginBottom: 12 }}>
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">오늘 지출 빠르게 기록</span>
        </div>
        <div className="erp-detail-body">
          <p className="mb-3 text-xs" style={{ color: "var(--erp-text-muted)" }}>
            문서를 따로 만들지 않아도 됩니다 — 같은 부서·카드로 이번 달에 이미 쓴 문서가 있으면 거기에 이어서
            추가되고, 없으면 자동으로 새로 만들어집니다.
          </p>
          <QuickPaymentRequestForm defaultDepartment={company?.name ?? ""} today={todayKstStr()} />
        </div>
      </div>

      <div className="erp-toolbar">
        <Link href="/reports/payment-requests/new" className="erp-btn erp-btn-primary">
          F2 글쓰기
        </Link>
        <button type="button" className="erp-btn" disabled title="추후 예정">
          엑셀 다운로드
        </button>
        <Link href="/dashboard" className="erp-btn erp-btn-danger">
          ESC 닫기
        </Link>
      </div>

      <PaymentRequestGridTable rows={gridRows} />
    </div>
  );
}
