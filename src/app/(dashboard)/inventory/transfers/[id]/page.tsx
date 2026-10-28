import { notFound } from "next/navigation";
import { isUuid } from "@/lib/is-uuid";
import { createClient } from "@/lib/supabase/server";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { DetailPageHeader } from "@/components/erp/page-header";
import { DeleteButton } from "@/components/delete-button";
import { CloseButton } from "@/components/erp/close-button";
import { deleteStockTransfer } from "@/app/(dashboard)/inventory/transfers/actions";
import { formatNumber } from "@/lib/format-number";
import { resolveBackHref } from "@/lib/list-return";

export default async function StockTransferDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ back?: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const { back } = await searchParams;
  const closeHref = resolveBackHref("/inventory/warehouses", back);
  const supabase = await createClient();

  const [{ data: transfer }, { data: items }] = await Promise.all([
    supabase
      .from("stock_transfers")
      .select(
        "id, transfer_date, memo, from_warehouse:warehouses!from_warehouse_id(name), to_warehouse:warehouses!to_warehouse_id(name), created_at, profiles!created_by(full_name)",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("stock_transfer_items")
      .select("id, quantity, remark, products(sku, name, spec, unit)")
      .eq("stock_transfer_id", id),
  ]);

  if (!transfer) notFound();

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: closeHref } }} />
      <DetailPageHeader
        title={`창고 이동 · ${transfer.from_warehouse?.name ?? "-"} → ${transfer.to_warehouse?.name ?? "-"}`}
        meta={
          <>
            이동일 {transfer.transfer_date.replaceAll("-", ".")} · 등록자{" "}
            {transfer.profiles?.full_name ?? "-"}
          </>
        }
        actions={
          <>
            <DeleteButton
              action={deleteStockTransfer}
              id={transfer.id}
              confirmMessage="이 창고 이동을 취소하시겠습니까? 옮겨졌던 재고가 원래대로 되돌아갑니다."
            />
            <CloseButton href={closeHref}>ESC 목록으로</CloseButton>
          </>
        }
      />

      {transfer.memo && (
        <p className="mb-3 text-sm" style={{ color: "var(--erp-text-muted)" }}>
          메모: {transfer.memo}
        </p>
      )}

      <div className="erp-grid-wrap has-card-view">
        <table className="erp-grid">
          <thead>
            <tr>
              <th>품목</th>
              <th style={{ width: 140 }}>규격</th>
              <th className="num" style={{ width: 110 }}>수량</th>
              <th>비고</th>
            </tr>
          </thead>
          <tbody>
            {(items ?? []).map((item) => (
              <tr key={item.id}>
                <td>{item.products?.name ?? "-"}</td>
                <td>{item.products?.spec ?? "-"}</td>
                <td className="num">
                  {formatNumber(Number(item.quantity))} {item.products?.unit ?? ""}
                </td>
                <td>{item.remark ?? "-"}</td>
              </tr>
            ))}
            {!items?.length && (
              <tr>
                <td colSpan={4} className="erp-grid-empty">
                  이동 품목이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="erp-row-card-list">
        {(items ?? []).map((item) => (
          <div className="erp-row-card" key={item.id}>
            <div className="erp-row-card-head">
              <span className="erp-row-card-partner">{item.products?.name ?? "-"}</span>
            </div>
            <dl className="erp-order-item-fields">
              <div>
                <dt>규격</dt>
                <dd>{item.products?.spec ?? "-"}</dd>
              </div>
              <div>
                <dt>수량</dt>
                <dd>
                  {formatNumber(Number(item.quantity))} {item.products?.unit ?? ""}
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
        {!items?.length && <p className="erp-grid-empty">이동 품목이 없습니다.</p>}
      </div>
    </div>
  );
}
