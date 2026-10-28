import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ListPageHeader } from "@/components/erp/page-header";
import { PageGuide } from "@/components/erp/page-guide";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { ExcelImportForm } from "@/components/excel-import-form";
import { GridBadge } from "@/components/grid/badge";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { formatNumber } from "@/lib/format-number";
import { importHometaxReceivedInvoices } from "@/app/(dashboard)/purchases/tax-invoices/import/actions";

type ReceivedInvoiceRow = {
  id: string;
  hometax_approval_number: string;
  issue_date: string;
  supplier_name: string;
  total_amount: number;
  purchase_order_id: string | null;
};

export default async function PurchaseTaxInvoiceImportPage() {
  const supabase = await createClient();
  const rows = await fetchAllRows<ReceivedInvoiceRow>((from, to) =>
    supabase
      .from("purchase_received_invoices")
      .select("id, hometax_approval_number, issue_date, supplier_name, total_amount, purchase_order_id")
      .order("issue_date", { ascending: false })
      .range(from, to),
  );
  const unmatchedCount = rows.filter((r) => !r.purchase_order_id).length;

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/purchases" } }} />
      <ListPageHeader title="매입관리 > 매입세금계산서 수취" />

      <PageGuide>
        API 연동 없이 홈택스 [조회/발급 &gt; 매입매출내역 조회]에서 받은 엑셀을 그대로 업로드하면, 승인번호 기준으로
        중복 없이 저장하고 공급처·금액·날짜로 매입 건과 자동 매칭합니다. 매칭 안 된 건은 아래 목록에서 &ldquo;미매칭&rdquo;으로
        표시되니, 매입 건이 맞게 등록돼 있는지 확인해주세요.
      </PageGuide>

      <ExcelImportForm action={importHometaxReceivedInvoices} />

      {unmatchedCount > 0 && (
        <p className="text-xs" style={{ color: "var(--erp-danger)", marginTop: 10 }}>
          미매칭 {formatNumber(unmatchedCount)}건 — 매입 건이 등록돼 있는지, 공급처 사업자번호가 맞는지 확인해주세요.
        </p>
      )}

      <div className="erp-grid-wrap has-card-view" style={{ marginTop: 14 }}>
        <table className="erp-grid">
          <thead>
            <tr>
              <th>작성일자</th>
              <th>승인번호</th>
              <th>공급자</th>
              <th className="num">합계금액</th>
              <th>매입 건 매칭</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{new Date(r.issue_date).toLocaleDateString("ko-KR")}</td>
                <td style={{ color: "var(--erp-text-muted)" }}>{r.hometax_approval_number}</td>
                <td>{r.supplier_name}</td>
                <td className="num">{formatNumber(r.total_amount)}</td>
                <td>
                  {r.purchase_order_id ? (
                    <Link href={`/purchases/${r.purchase_order_id}`} style={{ color: "inherit" }}>
                      <GridBadge tone="ok">✓ 매칭됨</GridBadge>
                    </Link>
                  ) : (
                    <GridBadge tone="danger">미매칭</GridBadge>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="erp-grid-empty">
                  가져온 매입세금계산서가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="erp-row-card-list" style={{ marginTop: 14 }}>
        {rows.map((r) => (
          <div className="erp-row-card" key={r.id}>
            <div className="erp-row-card-head">
              <span className="erp-row-card-partner">{r.supplier_name}</span>
              <span className="erp-row-card-date">{new Date(r.issue_date).toLocaleDateString("ko-KR")}</span>
            </div>
            <dl className="erp-order-item-fields">
              <div>
                <dt>승인번호</dt>
                <dd>{r.hometax_approval_number}</dd>
              </div>
              <div>
                <dt>합계금액</dt>
                <dd>{formatNumber(r.total_amount)}</dd>
              </div>
            </dl>
            <div className="erp-row-card-foot">
              {r.purchase_order_id ? (
                <Link href={`/purchases/${r.purchase_order_id}`} style={{ color: "inherit" }}>
                  <GridBadge tone="ok">✓ 매칭됨</GridBadge>
                </Link>
              ) : (
                <GridBadge tone="danger">미매칭</GridBadge>
              )}
            </div>
          </div>
        ))}
        {rows.length === 0 && <p className="erp-grid-empty">가져온 매입세금계산서가 없습니다.</p>}
      </div>
    </div>
  );
}
