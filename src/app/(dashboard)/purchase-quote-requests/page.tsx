import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { ListPageHeader, FormSection } from "@/components/erp/page-header";
import { GridBadge } from "@/components/grid/badge";
import { PurchaseQuoteRequestDetailPanel } from "@/components/purchase-quote-request-detail-panel";
import { NewPurchaseQuoteRequestForm } from "@/components/new-purchase-quote-request-form";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { isUuid } from "@/lib/is-uuid";
import { todayKstStr } from "@/lib/kst-date";
import { formatNumber } from "@/lib/format-number";

export default async function PurchaseQuoteRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  const selectedId = id && isUuid(id) ? id : undefined;
  const supabase = await createClient();

  const [{ data: requests }, { data: suppliers }] = await Promise.all([
    supabase
      .from("purchase_quote_requests")
      .select(
        "id, request_date, status, memo, target_supplier_ids, converted_purchase_request_id, selected_supplier:suppliers!selected_supplier_id(name), purchase_quote_request_items(id)",
      )
      .order("request_date", { ascending: false })
      .limit(300),
    supabase.from("suppliers").select("id, name").limit(1000),
  ]);

  const supplierNameById = new Map((suppliers ?? []).map((s) => [s.id, s.name]));
  const rows = requests ?? [];
  const newHref = "/purchase-quote-requests";
  const rowHref = (reqId: string) => `/purchase-quote-requests?id=${reqId}`;

  let formData: {
    suppliers: { id: string; name: string }[];
    products: { id: string; sku: string; name: string; spec: string | null }[];
  } | null = null;
  if (!selectedId) {
    const [allSuppliers, products] = await Promise.all([
      fetchAllRows<{ id: string; name: string }>((f, t) => supabase.from("suppliers").select("id, name").order("name").range(f, t)),
      fetchAllRows<{ id: string; sku: string; name: string; spec: string | null }>((f, t) =>
        supabase.from("products").select("id, sku, name, spec").order("name").range(f, t),
      ),
    ]);
    formData = { suppliers: allSuppliers, products };
  }

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ F2: { href: newHref }, Escape: { href: selectedId ? newHref : "/dashboard" } }} />
      <div className="erp-page-toolbar erp-detail-header-row">
        <ListPageHeader
          title="매입관리 > 구매 견적요청"
          actions={
            <>
              <Link href={newHref} className="erp-btn erp-btn-primary">
                F2 견적요청 작성
              </Link>
              {selectedId && (
                <Link href={newHref} className="erp-btn">
                  목록
                </Link>
              )}
            </>
          }
        />
      </div>

      <div className="erp-split-shell" data-mobile-view={selectedId ? "detail" : "list"}>
        <section className="erp-split-list">
          <div className="erp-split-list-head">
            <span>견적요청 목록</span>
            <span style={{ color: "var(--erp-text-muted)", fontWeight: 400 }}>총 {formatNumber(rows.length)}건</span>
          </div>
          <div className="erp-split-list-body">
            {rows.map((r) => (
              <Link
                key={r.id}
                href={rowHref(r.id)}
                className={`erp-split-list-row${r.id === selectedId ? " active" : ""}`}
              >
                {r.target_supplier_ids.map((sid) => supplierNameById.get(sid) ?? "-").join(", ")}
                <span style={{ marginLeft: 6 }}>
                  <GridBadge tone={r.status === "closed" ? "ok" : "warn"}>
                    {r.status === "closed" ? "확정완료" : "비교중"}
                  </GridBadge>
                </span>
                <div className="erp-split-list-row-sub">
                  품목 {(r.purchase_quote_request_items ?? []).length}건 · {r.request_date.replaceAll("-", ".")}
                  {r.selected_supplier?.name ? ` · 확정: ${r.selected_supplier.name}` : ""}
                  {r.converted_purchase_request_id ? " · 구매요청 전환됨" : ""}
                </div>
              </Link>
            ))}
            {rows.length === 0 && (
              <p className="p-3 text-xs" style={{ color: "var(--erp-text-muted)" }}>
                등록된 견적요청이 없습니다.
              </p>
            )}
          </div>
        </section>

        <div className="erp-split-detail">
          {selectedId ? (
            <PurchaseQuoteRequestDetailPanel id={selectedId} closeHref={newHref} />
          ) : (
            formData && (
              <FormSection tabLabel="견적요청 작성">
                <NewPurchaseQuoteRequestForm today={todayKstStr()} suppliers={formData.suppliers} products={formData.products} />
              </FormSection>
            )
          )}
        </div>
      </div>
    </div>
  );
}
