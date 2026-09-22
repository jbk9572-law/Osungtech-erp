import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "@/components/print-button";
import { CloseButton } from "@/components/erp/close-button";
import { QuotationDoc, type QuotationItem } from "@/components/quotation-doc";

export default async function QuotePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: quote }, { data: items }, { data: company }] = await Promise.all([
    supabase
      .from("quotes")
      .select("id, doc_no, quote_date, valid_until, memo, customers(name, contact_name, phone, address)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("quote_items")
      .select("id, custom_name, spec, quantity, unit_price, remark, products(name, spec)")
      .eq("quote_id", id)
      .order("created_at"),
    supabase.from("company_profile").select("*").maybeSingle(),
  ]);

  if (!quote) notFound();

  const quotationItems: QuotationItem[] = (items ?? []).map((item) => ({
    id: item.id,
    productLabel: item.products?.name ?? item.custom_name ?? "-",
    spec: item.spec || item.products?.spec || "",
    quantity: Number(item.quantity),
    unitPrice: Number(item.unit_price),
    remark: item.remark,
  }));

  return (
    <div className="mx-auto max-w-3xl print-page-wrapper">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <CloseButton href={`/quotes/${id}`} className="erp-btn erp-btn-dark print:hidden">
          견적서로 돌아가기
        </CloseButton>
        <PrintButton />
      </div>
      <QuotationDoc
        company={company}
        customer={quote.customers}
        docNumber={String(quote.doc_no)}
        quoteDate={quote.quote_date}
        validUntil={quote.valid_until}
        items={quotationItems}
        memo={quote.memo}
      />
    </div>
  );
}
