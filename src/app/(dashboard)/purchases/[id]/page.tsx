import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DeleteButton } from "@/components/delete-button";
import { deletePurchase } from "@/app/(dashboard)/purchases/actions";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { formatPackageQty } from "@/lib/package-qty";

export default async function PurchaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: order }, { data: items }] = await Promise.all([
    supabase
      .from("purchase_orders")
      .select("*, suppliers(*)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("purchase_order_items")
      .select("*, products(sku, name, spec, unit, base_package_qty)")
      .eq("purchase_order_id", id)
      .order("created_at"),
  ]);

  if (!order) {
    notFound();
  }

  const rows = (items ?? []).map((item) => ({
    ...item,
    amount: item.quantity * Number(item.unit_cost),
  }));
  const totalAmount = rows.reduce((sum, row) => sum + row.amount, 0);

  return (
    <div>
      <KeyboardShortcuts
        shortcuts={{
          F4: { href: `/purchases/${id}/edit` },
          Escape: { href: "/purchases" },
        }}
      />
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-lg font-bold text-[#1c1c1c]">구매관리 &gt; 발주 상세</h1>
        <div className="erp-toolbar" style={{ marginBottom: 0 }}>
          <Link href={`/purchases/${id}/edit`} className="erp-btn">
            F4 수정
          </Link>
          <DeleteButton
            action={deletePurchase}
            id={id}
            confirmMessage="이 매입 거래를 삭제하시겠습니까? 재고 수량이 자동으로 되돌아갑니다."
          />
          <Link href="/purchases" className="erp-btn">
            ESC 닫기
          </Link>
        </div>
      </div>
      <p className="mb-4 text-xs text-[#6b7280]">
        {new Date(order.purchase_date).toLocaleDateString("ko-KR")} 입고
      </p>

      <div className="erp-detail" style={{ marginTop: 0, marginBottom: 12 }}>
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">기본정보</span>
        </div>
        <div className="erp-detail-body" style={{ fontSize: 12.5, paddingTop: 16, paddingBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 26, marginBottom: 8 }}>
            <span style={{ width: 72, color: "var(--erp-text-muted)" }}>업체명</span>
            <span>{order.suppliers?.name ?? "-"}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 26, marginBottom: 8 }}>
            <span style={{ width: 72, color: "var(--erp-text-muted)" }}>담당자</span>
            <span>{order.suppliers?.contact_name ?? "-"}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 26 }}>
            <span style={{ width: 72, color: "var(--erp-text-muted)" }}>연락처</span>
            <span>{order.suppliers?.phone ?? "-"}</span>
          </div>
          {order.memo && (
            <p style={{ marginTop: 12, color: "var(--erp-text-muted)" }}>메모: {order.memo}</p>
          )}
        </div>
      </div>

      <div className="erp-grid-wrap">
        <table className="erp-grid">
          <thead>
            <tr>
              <th>SKU</th>
              <th>품목명</th>
              <th>규격</th>
              <th>단위</th>
              <th className="num">포장수량</th>
              <th className="num">수량</th>
              <th className="num">매입가</th>
              <th className="num">합계금액</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td style={{ color: "var(--erp-text-muted)" }}>{row.products?.sku}</td>
                <td>{row.products?.name}</td>
                <td style={{ color: "var(--erp-text-muted)" }}>
                  {row.spec || row.products?.spec || "-"}
                </td>
                <td style={{ color: "var(--erp-text-muted)" }}>{row.products?.unit}</td>
                <td className="num" style={{ color: "var(--erp-text-muted)" }}>
                  {formatPackageQty(row.products?.base_package_qty, row.quantity)}
                </td>
                <td className="num">{row.quantity.toLocaleString()}</td>
                <td className="num" style={{ color: "var(--erp-text-muted)" }}>
                  {Number(row.unit_cost).toLocaleString()}
                </td>
                <td className="num">{row.amount.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: "#eef1f5", fontWeight: 700 }}>
              <td colSpan={7} className="num">
                합계
              </td>
              <td className="num">{totalAmount.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
