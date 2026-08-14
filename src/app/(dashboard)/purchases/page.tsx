import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getDatePresets } from "@/lib/date-presets";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { buildListReturnParam } from "@/lib/list-return";
import { PurchaseGridTable, type PurchaseRow } from "@/components/purchase-grid-table";

type DisplayRow = PurchaseRow;

export default async function PurchasesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; q?: string }>;
}) {
  const { from, to, q } = await searchParams;
  // 상세 화면에서 ESC/닫기를 누르면 지금 걸어둔 검색/필터로 되돌아오게,
  // 목록 링크에 지금 화면의 쿼리스트링을 실어 보낸다.
  const backParam = buildListReturnParam({ q, from, to });
  const supabase = await createClient();

  let query = supabase
    .from("purchase_order_items")
    .select(
      "*, purchase_orders!inner(id, purchase_date, memo, delivery_method, doc_no, suppliers(id, name), profiles!created_by(full_name)), products(sku, name, spec, unit)"
    )
    // 매입일자(업무상 날짜) 기준으로 최신이 위로 오게 정렬한다. `{ foreignTable }`
    // 옵션은 상위 테이블을 하위 임베드 테이블 값으로 정렬하는 방향으로는
    // 실제로 적용되지 않는 postgrest-js의 알려진 제약이라, PostgREST의
    // `table(column)` 표기를 컬럼명 자리에 직접 써서 우회한다.
    .order("purchase_orders(purchase_date)", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);

  if (from) query = query.gte("purchase_orders.purchase_date", from);
  if (to) query = query.lte("purchase_orders.purchase_date", to);

  // 매입 옆에 지급 내역도 같은 목록에 섞어서 보여준다 — sales/page.tsx와
  // 동일한 방식(표시용으로만 합침, 실제 정산은 lib/ar-ap.ts 그대로).
  let paymentQuery = supabase
    .from("supplier_payments")
    .select("id, paid_at, amount, memo, suppliers(id, name)")
    .order("paid_at", { ascending: false })
    .limit(200);
  if (from) paymentQuery = paymentQuery.gte("paid_at", from);
  if (to) paymentQuery = paymentQuery.lte("paid_at", to);

  const [{ data: rawItems }, { data: rawPayments }] = await Promise.all([query, paymentQuery]);

  const keyword = q?.trim().toLowerCase();
  const items = keyword
    ? rawItems?.filter(
        (item) =>
          item.purchase_orders?.suppliers?.name?.toLowerCase().includes(keyword) ||
          item.products?.name?.toLowerCase().includes(keyword) ||
          item.products?.sku?.toLowerCase().includes(keyword) ||
          (item.spec || item.products?.spec)?.toLowerCase().includes(keyword)
      )
    : rawItems;

  const itemRows = (items ?? []).map((item) => {
    const supplyAmount = item.quantity * Number(item.unit_cost);
    const taxAmount = Math.round(supplyAmount * 0.1);
    return { ...item, supplyAmount, taxAmount };
  });

  // 같은 매입 건(purchase_order)에 속한 품목은 검색 여부와 상관없이 한 행으로
  // 묶어서 보여준다. 품목이 여러 개면 품목명 칸에 "첫 품목명 외 N건"으로
  // 요약한다. 검색어로 일부 품목만 걸러졌다면(예: 상품명/SKU 검색) 그
  // 매칭된 품목들만 묶여서 "외 N건"에 반영된다.
  const purchaseRows: DisplayRow[] = Object.values(
    itemRows.reduce<Record<string, DisplayRow & { itemCount: number }>>((acc, item) => {
      const orderId = item.purchase_orders?.id ?? item.id;
      if (!acc[orderId]) {
        acc[orderId] = {
          key: orderId,
          kind: "purchase",
          orderId,
          supplierId: item.purchase_orders?.suppliers?.id,
          docNo: item.purchase_orders?.doc_no,
          date: item.purchase_orders?.purchase_date,
          supplierName: item.purchase_orders?.suppliers?.name,
          authorName: item.purchase_orders?.profiles?.full_name,
          productLabel: item.products?.name ?? "-",
          spec: item.spec || item.products?.spec || "-",
          quantity: 0,
          unit: item.products?.unit,
          unitCost: Number(item.unit_cost),
          supplyAmount: 0,
          taxAmount: 0,
          deliveryMethod: item.purchase_orders?.delivery_method,
          itemCount: 0,
        };
      } else {
        // 품목이 2건 이상이면 단가를 하나로 대표할 수 없으니 비워둔다.
        acc[orderId].unitCost = null;
      }
      acc[orderId].itemCount += 1;
      acc[orderId].quantity += item.quantity;
      acc[orderId].supplyAmount += item.supplyAmount;
      acc[orderId].taxAmount += item.taxAmount;
      return acc;
    }, {})
  ).map((row) => ({
    ...row,
    productLabel: row.itemCount > 1 ? `${row.productLabel} 외 ${row.itemCount - 1}건` : row.productLabel,
  }));

  const payments = keyword
    ? rawPayments?.filter(
        (p) => p.suppliers?.name?.toLowerCase().includes(keyword) || p.memo?.toLowerCase().includes(keyword)
      )
    : rawPayments;
  const paymentRows: DisplayRow[] = (payments ?? []).map((p) => ({
    key: `payment-${p.id}`,
    kind: "payment",
    orderId: undefined,
    supplierId: p.suppliers?.id,
    docNo: null,
    date: p.paid_at,
    supplierName: p.suppliers?.name,
    authorName: undefined,
    productLabel: p.memo || "지급",
    spec: "-",
    quantity: 0,
    unit: undefined,
    unitCost: null,
    supplyAmount: Number(p.amount),
    taxAmount: 0,
    deliveryMethod: null,
  }));

  const rows: DisplayRow[] = [...purchaseRows, ...paymentRows].sort((a, b) =>
    (b.date ?? "").localeCompare(a.date ?? "")
  );

  const totalQuantity = itemRows.reduce((sum, row) => sum + row.quantity, 0);
  const totalSupply = itemRows.reduce((sum, row) => sum + row.supplyAmount, 0);
  const totalTax = itemRows.reduce((sum, row) => sum + row.taxAmount, 0);
  const presets = getDatePresets();
  const exportHref = q ? `/api/purchases/export?q=${encodeURIComponent(q)}` : "/api/purchases/export";

  return (
    <div>
      <KeyboardShortcuts
        shortcuts={{
          F2: { href: "/purchases/new" },
          F5: { submitFormSelector: "#purchases-search-form" },
          F8: { href: exportHref, newTab: true },
          Escape: { href: "/dashboard" },
        }}
      />
      <h1 className="mb-3 text-lg font-bold text-[#182338]">매입관리</h1>

      <div className="erp-date-presets" style={{ marginBottom: 8 }}>
        {presets.map((preset) => (
          <Link
            key={preset.label}
            href={`/purchases?from=${preset.from}&to=${preset.to}`}
            className={`erp-date-preset-btn${from === preset.from && to === preset.to ? " active" : ""}`}
          >
            {preset.label}
          </Link>
        ))}
      </div>

      <form method="get" id="purchases-search-form" className="erp-search">
        <div className="erp-field">
          <label>시작일</label>
          <input type="date" name="from" defaultValue={from ?? ""} className="erp-input" />
        </div>
        <div className="erp-field">
          <label>종료일</label>
          <input type="date" name="to" defaultValue={to ?? ""} className="erp-input" />
        </div>
        <div className="erp-field" style={{ minWidth: 220, flex: 1 }}>
          <label>공급처 / 상품 / 규격 검색</label>
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="공급처명, 상품명, SKU, 규격"
            className="erp-input"
            style={{ width: "100%" }}
          />
        </div>
        <button type="submit" className="erp-btn erp-btn-primary">
          F5 조회
        </button>
        {(from || to || q) && (
          <Link href="/purchases" className="erp-btn">
            초기화
          </Link>
        )}
      </form>

      <div className="erp-toolbar">
        <Link href="/purchases/new" className="erp-btn erp-btn-primary">
          F2 신규
        </Link>
        <a
          href={exportHref}
          className="erp-btn"
          title={q ? `이번달 "${q}" 검색 결과를 엑셀로 다운로드` : "이번달(1일~말일) 전체 내역을 엑셀로 다운로드"}
        >
          📥 엑셀 다운로드
        </a>
        <Link href="/dashboard" className="erp-btn erp-btn-danger">
          ESC 닫기
        </Link>
      </div>

      <PurchaseGridTable
        rows={rows}
        totalQuantity={totalQuantity}
        totalSupply={totalSupply}
        totalTax={totalTax}
        backParam={backParam ?? ""}
      />
    </div>
  );
}
