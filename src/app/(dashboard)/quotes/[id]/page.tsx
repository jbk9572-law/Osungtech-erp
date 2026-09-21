import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { DetailPageHeader } from "@/components/erp/page-header";
import { DeleteButton } from "@/components/delete-button";
import { QuoteStatusBadge } from "@/components/quote-status-badge";
import { QuoteStatusForm } from "@/components/quote-status-form";
import { ConvertQuoteForm } from "@/components/convert-quote-form";
import { PageGuide } from "@/components/erp/page-guide";
import { deleteQuote } from "@/app/(dashboard)/quotes/actions";

export default async function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: quote }, { data: items }, { data: warehouses }] = await Promise.all([
    supabase
      .from("quotes")
      .select("id, doc_no, quote_date, valid_until, status, memo, converted_sales_order_id, customers(id, name)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("quote_items")
      .select("id, spec, quantity, unit_price, remark, products(sku, name)")
      .eq("quote_id", id),
    supabase.from("warehouses").select("id, name").order("name"),
  ]);

  if (!quote) notFound();

  const total = (items ?? []).reduce((sum, i) => sum + Number(i.quantity) * Number(i.unit_price), 0);

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/quotes" } }} />
      <DetailPageHeader
        title={`견적서 #${quote.doc_no}`}
        meta={
          <>
            {quote.customers?.name ?? "-"} · {quote.quote_date.replaceAll("-", ".")}
            {quote.valid_until ? ` · 유효기간 ~${quote.valid_until.replaceAll("-", ".")}` : ""}
          </>
        }
        actions={
          <>
            <QuoteStatusForm id={quote.id} currentStatus={quote.status} />
            <DeleteButton action={deleteQuote} id={quote.id} confirmMessage="이 견적서를 삭제하시겠습니까?" />
          </>
        }
      />

      <div className="mb-3">
        <QuoteStatusBadge status={quote.status} />
      </div>

      {quote.converted_sales_order_id ? (
        <p className="mb-4 rounded p-2 text-xs" style={{ background: "var(--erp-success-bg)", color: "var(--erp-success)", border: "1px solid var(--erp-success-border)" }}>
          이 견적서는 매출로 전환되었습니다.{" "}
          <Link href={`/sales/${quote.converted_sales_order_id}`} style={{ textDecoration: "underline" }}>
            매출 전표 보기
          </Link>
        </p>
      ) : (
        <div className="erp-detail" style={{ marginTop: 0 }}>
          <div className="erp-detail-tabs">
            <span className="erp-detail-tab active">매출로 전환</span>
          </div>
          <div className="erp-detail-body">
            <PageGuide>
              품목을 다시 입력할 필요 없이, 이 견적 내용 그대로 매출 전표를 생성합니다. 전환할 창고만 선택해주세요.
            </PageGuide>
            <ConvertQuoteForm quoteId={quote.id} warehouses={warehouses ?? []} />
          </div>
        </div>
      )}

      {quote.memo && (
        <p className="mb-3 text-sm" style={{ color: "var(--erp-text-muted)" }}>
          메모: {quote.memo}
        </p>
      )}

      <div className="erp-grid-wrap">
        <table className="erp-grid">
          <thead>
            <tr>
              <th>품목</th>
              <th style={{ width: 140 }}>규격</th>
              <th className="num" style={{ width: 90 }}>수량</th>
              <th className="num" style={{ width: 110 }}>단가</th>
              <th className="num" style={{ width: 110 }}>금액</th>
              <th>비고</th>
            </tr>
          </thead>
          <tbody>
            {(items ?? []).map((item) => (
              <tr key={item.id}>
                <td>{item.products?.name ?? "-"}</td>
                <td>{item.spec ?? "-"}</td>
                <td className="num">{Number(item.quantity).toLocaleString()}</td>
                <td className="num">{Number(item.unit_price).toLocaleString()}</td>
                <td className="num">{(Number(item.quantity) * Number(item.unit_price)).toLocaleString()}</td>
                <td>{item.remark ?? "-"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4} className="num" style={{ fontWeight: 700 }}>
                합계
              </td>
              <td className="num" style={{ fontWeight: 700 }}>
                {total.toLocaleString()}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
