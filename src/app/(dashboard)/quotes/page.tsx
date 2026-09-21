import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { ListPageHeader } from "@/components/erp/page-header";
import { ClickableRow } from "@/components/clickable-row";
import { QuoteStatusBadge } from "@/components/quote-status-badge";

export default async function QuotesPage() {
  const supabase = await createClient();

  const { data: quotes } = await supabase
    .from("quotes")
    .select("id, doc_no, quote_date, status, converted_sales_order_id, customers(name), quote_items(quantity, unit_price)")
    .order("quote_date", { ascending: false })
    .limit(300);

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ F2: { href: "/quotes/new" }, Escape: { href: "/dashboard" } }} />
      <ListPageHeader
        title="견적서관리"
        actions={
          <Link href="/quotes/new" className="erp-btn erp-btn-primary">
            F2 견적서 작성
          </Link>
        }
      />

      <div className="erp-grid-wrap">
        <table className="erp-grid">
          <thead>
            <tr>
              <th style={{ width: 90 }}>견적일</th>
              <th style={{ width: 80 }}>견적번호</th>
              <th style={{ width: 160 }}>거래처</th>
              <th className="num" style={{ width: 120 }}>합계금액</th>
              <th style={{ width: 90 }}>상태</th>
            </tr>
          </thead>
          <tbody>
            {(quotes ?? []).map((q) => {
              const total = (q.quote_items ?? []).reduce((sum, i) => sum + Number(i.quantity) * Number(i.unit_price), 0);
              return (
                <ClickableRow key={q.id} href={`/quotes/${q.id}`}>
                  <td>{q.quote_date.replaceAll("-", ".")}</td>
                  <td>{q.doc_no}</td>
                  <td>{q.customers?.name ?? "-"}</td>
                  <td className="num">{total.toLocaleString()}</td>
                  <td>
                    <QuoteStatusBadge status={q.status} />
                  </td>
                </ClickableRow>
              );
            })}
            {(!quotes || quotes.length === 0) && (
              <tr>
                <td colSpan={5} className="erp-grid-empty">
                  등록된 견적서가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
