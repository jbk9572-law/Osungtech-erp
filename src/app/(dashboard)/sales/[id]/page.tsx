import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DeleteButton } from "@/components/delete-button";
import { deleteSale } from "@/app/(dashboard)/sales/actions";

export default async function SaleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: order }, { data: items }] = await Promise.all([
    supabase
      .from("sales_orders")
      .select("*, customers(*), warehouses(name)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("sales_order_items")
      .select("*, products(sku, name, unit)")
      .eq("sales_order_id", id)
      .order("created_at"),
  ]);

  if (!order) {
    notFound();
  }

  const rows = (items ?? []).map((item) => ({
    ...item,
    amount: item.quantity * Number(item.unit_price),
  }));
  const totalAmount = rows.reduce((sum, row) => sum + row.amount, 0);

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-lg font-bold text-[#1c1c1c]">영업관리 &gt; 수주 상세</h1>
        <div className="erp-toolbar" style={{ marginBottom: 0 }}>
          <Link href={`/sales/${id}/print`} className="erp-btn">
            F9 명세표
          </Link>
          <Link href={`/sales/${id}/edit`} className="erp-btn">
            F4 수정
          </Link>
          <DeleteButton
            action={deleteSale}
            id={id}
            confirmMessage="이 매출 거래를 삭제하시겠습니까? 재고 수량이 자동으로 되돌아갑니다."
          />
          <Link href="/sales" className="erp-btn">
            ESC 닫기
          </Link>
        </div>
      </div>
      <p className="mb-4 text-xs text-[#6b7280]">
        {new Date(order.order_date).toLocaleDateString("ko-KR")} · {order.warehouses?.name} 출고
      </p>

      <div className="erp-detail" style={{ marginTop: 0, marginBottom: 12 }}>
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">기본정보</span>
        </div>
        <div className="erp-detail-body" style={{ fontSize: 12.5 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
            <span style={{ width: 72, color: "var(--erp-text-muted)" }}>거래처명</span>
            <span>{order.customers?.name ?? "-"}</span>
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
            <span style={{ width: 72, color: "var(--erp-text-muted)" }}>담당자</span>
            <span>{order.customers?.contact_name ?? "-"}</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <span style={{ width: 72, color: "var(--erp-text-muted)" }}>연락처</span>
            <span>{order.customers?.phone ?? "-"}</span>
          </div>
          {order.memo && (
            <p style={{ marginTop: 10, color: "var(--erp-text-muted)" }}>메모: {order.memo}</p>
          )}
        </div>
      </div>

      <div className="erp-grid-wrap">
        <table className="erp-grid">
          <thead>
            <tr>
              <th>품목명</th>
              <th>규격</th>
              <th className="num">수량</th>
              <th className="num">단가</th>
              <th className="num">금액</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.products?.name}</td>
                <td style={{ color: "var(--erp-text-muted)" }}>{row.products?.unit}</td>
                <td className="num">{row.quantity}</td>
                <td className="num" style={{ color: "var(--erp-text-muted)" }}>
                  {Number(row.unit_price).toLocaleString()}
                </td>
                <td className="num">{row.amount.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: "#eef1f5", fontWeight: 700 }}>
              <td colSpan={4}>합계</td>
              <td className="num">{totalAmount.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
