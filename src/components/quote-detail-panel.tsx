import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DetailPageHeader } from "@/components/erp/page-header";
import { DeleteButton } from "@/components/delete-button";
import { QuoteStatusBadge } from "@/components/quote-status-badge";
import { QuoteStatusForm } from "@/components/quote-status-form";
import { SendQuoteButton } from "@/components/send-quote-button";
import { ConvertQuoteForm } from "@/components/convert-quote-form";
import { PageGuide } from "@/components/erp/page-guide";
import { deleteQuote } from "@/app/(dashboard)/quotes/actions";
import { formatNumber } from "@/lib/format-number";
import { buildBackHref } from "@/lib/list-return";

// quotes/page.tsx의 목록+상세 분할 화면에서, 목록 옆 패널에 이 컴포넌트를
// 그대로 렌더링한다. 모달/직접 URL 접근(quotes/[id]/page.tsx)도 같은
// 컴포넌트를 쓴다.
export async function QuoteDetailPanel({ id, closeHref }: { id: string; closeHref: string }) {
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
    <>
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
            <Link href={`/quotes/${quote.id}/print?back=${buildBackHref(closeHref)}`} className="erp-btn">
              인쇄 / PDF
            </Link>
            {!quote.converted_sales_order_id && (
              <SendQuoteButton id={quote.id} sent={quote.status === "sent"} />
            )}
            <QuoteStatusForm id={quote.id} currentStatus={quote.status} />
            <DeleteButton action={deleteQuote} id={quote.id} confirmMessage="이 견적서를 삭제하시겠습니까?" />
            <Link href={closeHref} className="erp-btn">
              목록
            </Link>
          </>
        }
      />

      <div className="mb-3">
        <QuoteStatusBadge status={quote.status} />
      </div>

      {quote.converted_sales_order_id ? (
        <PageGuide tone="success">
          이 견적서는 매출로 전환되었습니다.{" "}
          <Link href={`/sales/${quote.converted_sales_order_id}`} style={{ textDecoration: "underline" }}>
            매출 전표 보기
          </Link>
        </PageGuide>
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

      <div className="erp-grid-wrap has-card-view">
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
                <td className="num">{formatNumber(Number(item.quantity))}</td>
                <td className="num">{formatNumber(Number(item.unit_price))}</td>
                <td className="num">{formatNumber((Number(item.quantity) * Number(item.unit_price)))}</td>
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
                {formatNumber(total)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="erp-row-card-list">
        {(items ?? []).length === 0 ? (
          <p className="erp-grid-empty">등록된 품목이 없습니다.</p>
        ) : (
          <>
            {(items ?? []).map((item) => (
              <div className="erp-row-card" key={item.id}>
                <div className="erp-row-card-head">
                  <span className="erp-row-card-partner">{item.products?.name ?? "-"}</span>
                </div>
                <dl className="erp-order-item-fields">
                  <div>
                    <dt>규격</dt>
                    <dd>{item.spec ?? "-"}</dd>
                  </div>
                  <div>
                    <dt>수량</dt>
                    <dd>{formatNumber(Number(item.quantity))}</dd>
                  </div>
                  <div>
                    <dt>단가</dt>
                    <dd>{formatNumber(Number(item.unit_price))}</dd>
                  </div>
                  <div>
                    <dt>금액</dt>
                    <dd style={{ fontWeight: 700 }}>
                      {formatNumber(Number(item.quantity) * Number(item.unit_price))}
                    </dd>
                  </div>
                  {item.remark && (
                    <div style={{ gridColumn: "1 / -1" }}>
                      <dt>비고</dt>
                      <dd>{item.remark}</dd>
                    </div>
                  )}
                </dl>
              </div>
            ))}
            <div className="erp-row-card-foot" style={{ fontWeight: 700 }}>
              <span>합계</span>
              <span className="erp-row-card-amount">{formatNumber(total)}</span>
            </div>
          </>
        )}
      </div>
    </>
  );
}
